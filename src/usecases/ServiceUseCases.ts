import type {
  ApplicationWithWorker,
  FarmerServiceItem,
  JobFilters,
  OpenService,
  Service,
  ServiceInput,
  ServiceStatus,
  ServiceUpdate,
  ServiceWithFarm
} from '../contracts';
import { APPLICATION_STATUS, SERVICE_STATUS } from '../constants/status';
import type { Clock } from '../domain/clock';
import { dayOf, isPastDay } from '../domain/dates';
import type {
  ApplicationRepository,
  FarmRepository,
  FarmerRepository,
  ServiceRepository,
  WorkerRepository
} from '../domain/repositories';
import { type Result, conflict, invalid, notFound, ok, requireFound } from '../domain/result';
import { toPublicProfile } from '../utils/profile';
import { farmOf, findActiveFarm, isExpired, toOpenService } from './shared';

// Texto para busca: sem acento e em minúsculas ("Colheita de Café" vira "colheita de cafe").
function searchable(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Serviços do lado do produtor (publicar, editar, cancelar) e as leituras de serviços/vagas.
// Aceite, candidatura, desistência e pagamento ficam em HiringUseCases.
export class ServiceUseCases {
  constructor(
    private readonly repos: {
      farmers: FarmerRepository;
      workers: WorkerRepository;
      farms: FarmRepository;
      services: ServiceRepository;
      applications: ApplicationRepository;
    },
    private readonly clock: Clock
  ) {}

  // RF01 - Publica um serviço Pending numa fazenda ativa do produtor.
  async request(input: ServiceInput): Promise<Result<Service>> {
    const farmer = await this.repos.farmers.findById(input.farmer_id);
    if (!farmer) return notFound('Produtor não encontrado.');

    const farm = await findActiveFarm(this.repos.farms, input.farm_id);
    if (!farm) return notFound('Fazenda não encontrada.');
    if (farm.farmer_id !== farmer.id) return invalid('Esta fazenda não pertence a este produtor.');

    const expiry = this.checkExpiry(input.expires_at);
    if (!expiry.ok) return expiry;

    const service = await this.repos.services.create({
      farmer_id: farmer.id,
      farm_id: farm.id,
      worker_id: null,
      payment_id: null,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      duration: input.duration,
      price: input.price,
      expires_at: input.expires_at ?? null,
      status: SERVICE_STATUS.PENDING,
      insertion_date: this.clock.now()
    });
    return ok(service);
  }

  // Só enquanto Pending (sem trabalhador aceito).
  async update(id: number, changes: ServiceUpdate): Promise<Result<Service>> {
    const service = await this.repos.services.findById(id);
    if (!service) return notFound('Serviço não encontrado.');
    if (service.status !== SERVICE_STATUS.PENDING) {
      return conflict('Só é possível editar serviços que ainda aguardam candidatos.');
    }

    if (changes.farm_id !== undefined) {
      const farm = await findActiveFarm(this.repos.farms, changes.farm_id);
      if (!farm) return notFound('Fazenda não encontrada.');
      if (farm.farmer_id !== service.farmer_id) return invalid('Esta fazenda não pertence a este produtor.');
      service.farm_id = farm.id;
    }
    if (changes.expires_at !== undefined) {
      const expiry = this.checkExpiry(changes.expires_at);
      if (!expiry.ok) return expiry;
      service.expires_at = changes.expires_at;
    }
    if (changes.name !== undefined) service.name = changes.name;
    if (changes.description !== undefined) service.description = changes.description;
    if (changes.category !== undefined) service.category = changes.category;
    if (changes.duration !== undefined) service.duration = changes.duration;
    if (changes.price !== undefined) service.price = changes.price;
    await this.repos.services.update(service);

    return ok(service);
  }

  // Só enquanto Pending. As candidaturas pendentes são recusadas.
  async cancel(id: number): Promise<Result<Service>> {
    const { services, applications } = this.repos;
    const service = await services.findById(id);
    if (!service) return notFound('Serviço não encontrado.');
    if (service.status !== SERVICE_STATUS.PENDING) {
      return conflict('Só é possível cancelar serviços que ainda aguardam candidatos.');
    }

    // TODO(db): executar numa transação (serviço + candidaturas).
    service.status = SERVICE_STATUS.CANCELLED;
    await services.update(service);
    for (const a of await applications.find({ service_id: service.id, status: APPLICATION_STATUS.PENDING })) {
      a.status = APPLICATION_STATUS.REJECTED;
      await applications.update(a);
    }

    return ok(service);
  }

  // A validade é o último dia para candidaturas: não pode ficar no passado.
  private checkExpiry(expiresAt: string | null | undefined): Result<null> {
    if (expiresAt && isPastDay(expiresAt, this.clock.now())) {
      return invalid('A validade precisa ser hoje ou uma data futura.');
    }
    return ok(null);
  }

  // --- LEITURAS ---

  // Serviço com a fazenda completa (mesmo que removida).
  async get(id: number): Promise<Result<ServiceWithFarm>> {
    const service = await this.repos.services.findById(id);
    if (!service) return notFound('Serviço não encontrado.');
    return ok({ ...service, farm: await farmOf(this.repos.farms, service) });
  }

  // Serviços do produtor, com a fazenda e a contagem de candidaturas pendentes.
  async listForFarmer(farmerId: number, status?: ServiceStatus): Promise<Result<FarmerServiceItem[]>> {
    const { farmers, farms, services, applications } = this.repos;
    const farmer = await farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const own = await services.find(status === undefined ? { farmer_id: farmer.id } : { farmer_id: farmer.id, status });
    const result = await Promise.all(
      own.map(async (s): Promise<FarmerServiceItem> => ({
        ...s,
        farm: await farmOf(farms, s),
        applications_pending: (await applications.find({ service_id: s.id, status: APPLICATION_STATUS.PENDING })).length
      }))
    );
    return ok(result);
  }

  // Candidaturas com o trabalhador embutido (CPF mascarado).
  async listApplications(id: number): Promise<Result<ApplicationWithWorker[]>> {
    const { services, applications, workers } = this.repos;
    const service = await services.findById(id);
    if (!service) return notFound('Serviço não encontrado.');

    const own = await applications.find({ service_id: service.id });
    const result = await Promise.all(
      own.map(async (a): Promise<ApplicationWithWorker> => {
        const worker = requireFound(await workers.findById(a.worker_id), `trabalhador da candidatura ${a.id}`);
        return { ...a, worker: toPublicProfile(worker) };
      })
    );
    return ok(result);
  }

  // RF02 - Vagas abertas: Pending e dentro da validade, com filtros combinados (E).
  // TODO(db): no PostgreSQL os filtros viram WHERE (status, category, duration BETWEEN, insertion_date,
  // expires_at >= hoje) e a busca de texto vira unaccent + ILIKE ou full-text search em português.
  async searchOpen(filters: JobFilters = {}): Promise<OpenService[]> {
    const now = this.clock.now();
    const open = (await this.repos.services.find({ status: SERVICE_STATUS.PENDING })).filter((s) => !isExpired(s, now));
    const withFarm = await Promise.all(open.map((s) => toOpenService(this.repos.farms, s)));

    const rejectedServiceIds = filters.worker_id === undefined
      ? new Set<number>()
      : new Set(
          (await this.repos.applications.find({ worker_id: filters.worker_id, status: APPLICATION_STATUS.REJECTED }))
            .map((a) => a.service_id)
        );

    const terms = searchable(filters.q ?? '').split(/\s+/).filter(Boolean);
    const result = withFarm.filter((job) => {
      if (rejectedServiceIds.has(job.id)) return false;
      if (filters.category && job.category !== filters.category) return false;
      if (filters.min_hours !== undefined && job.duration < filters.min_hours) return false;
      if (filters.max_hours !== undefined && job.duration > filters.max_hours) return false;
      const published = dayOf(job.insertion_date);
      if (filters.from && published < filters.from) return false;
      if (filters.to && published > filters.to) return false;
      if (terms.length > 0) {
        const haystack = searchable([job.name, job.description ?? '', job.category, job.farm.city].join(' '));
        if (!terms.every((t) => haystack.includes(t))) return false;
      }
      return true;
    });

    const byRecent = (a: OpenService, b: OpenService): number =>
      b.insertion_date.localeCompare(a.insertion_date) || b.id - a.id;
    const sorters: Record<NonNullable<JobFilters['sort']>, (a: OpenService, b: OpenService) => number> = {
      recent: byRecent,
      price_desc: (a, b) => b.price - a.price || byRecent(a, b),
      price_asc: (a, b) => a.price - b.price || byRecent(a, b),
      duration_asc: (a, b) => a.duration - b.duration || byRecent(a, b),
      duration_desc: (a, b) => b.duration - a.duration || byRecent(a, b)
    };
    return result.sort(sorters[filters.sort ?? 'recent']);
  }

  // Detalhe da vaga (em qualquer status) com cidade/UF da fazenda; o ponto no mapa só vai para
  // o trabalhador aceito (`viewerWorkerId`).
  async getOpen(id: number, viewerWorkerId?: number): Promise<Result<OpenService>> {
    const service = await this.repos.services.findById(id);
    if (!service) return notFound('Serviço não encontrado.');
    return ok(await toOpenService(this.repos.farms, service, viewerWorkerId));
  }
}
