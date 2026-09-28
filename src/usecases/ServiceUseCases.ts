import type {
  ApplicationWithWorker,
  FarmerServiceItem,
  OpenService,
  Service,
  ServiceInput,
  ServiceStatus,
  ServiceUpdate,
  ServiceWithFarm
} from '../contracts';
import { APPLICATION_STATUS, SERVICE_STATUS } from '../constants/status';
import type { Clock } from '../domain/clock';
import type {
  ApplicationRepository,
  FarmRepository,
  FarmerRepository,
  ServiceRepository,
  WorkerRepository
} from '../domain/repositories';
import { type Result, conflict, invalid, notFound, ok, requireFound } from '../domain/result';
import { toPublicProfile } from '../utils/profile';
import { farmOf, findActiveFarm, toOpenService } from './shared';

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

    const service = await this.repos.services.create({
      farmer_id: farmer.id,
      farm_id: farm.id,
      worker_id: null,
      payment_id: null,
      name: input.name,
      category: input.category,
      duration: input.duration,
      price: input.price,
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
    if (changes.name !== undefined) service.name = changes.name;
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

  // RF02 - Vagas abertas (Pending), opcionalmente de uma categoria.
  async searchOpen(category?: string): Promise<OpenService[]> {
    const open = await this.repos.services.find({ status: SERVICE_STATUS.PENDING });
    const filtered = category ? open.filter((s) => s.category === category) : open;
    return Promise.all(filtered.map((s) => toOpenService(this.repos.farms, s)));
  }

  // Detalhe da vaga (em qualquer status) com cidade/UF da fazenda.
  async getOpen(id: number): Promise<Result<OpenService>> {
    const service = await this.repos.services.findById(id);
    if (!service) return notFound('Serviço não encontrado.');
    return ok(await toOpenService(this.repos.farms, service));
  }
}
