import type { FarmRepository } from '#modules/farms';
import { APPLICATION_STATUS, type ApplicationRepository } from '#modules/hiring';
import type { Clock } from '#shared/domain/clock';
import { dayOf } from '#shared/domain/dates';
import type { FarmReputationReader } from '../domain/farm-reputation';
import { searchable } from '#shared/utils/search';
import { SERVICE_STATUS } from '../domain/service-status';
import type { ServiceRepository } from '../domain/service.repository';
import { isExpired, toOpenService } from '../domain/service.rules';
import type { JobFilters, OpenService } from '../service.contract';

export interface SearchOpenServicesDeps {
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  clock: Clock;
  reputation: FarmReputationReader;
}

const byRecent = (a: OpenService, b: OpenService): number =>
  b.insertion_date.localeCompare(a.insertion_date) || b.id - a.id;

const SORTERS: Record<NonNullable<JobFilters['sort']>, (a: OpenService, b: OpenService) => number> = {
  recent: byRecent,
  price_desc: (a, b) => b.price - a.price || byRecent(a, b),
  price_asc: (a, b) => a.price - b.price || byRecent(a, b),
  duration_asc: (a, b) => a.duration - b.duration || byRecent(a, b),
  duration_desc: (a, b) => b.duration - a.duration || byRecent(a, b),
  // Média ponderada pela quantidade de avaliações (uma nota 5 sozinha não passa na frente de vinte notas 4,8).
  rating: (a, b) => (b.farm.reputation?.score ?? 0) - (a.farm.reputation?.score ?? 0) || byRecent(a, b)
};

// RF02 - Vagas abertas: Pending e dentro da validade, com filtros combinados (E).
// Com `worker_id`, some a vaga em que esse trabalhador já foi recusado. Cada vaga traz a reputação da fazenda.
// TODO(db): no PostgreSQL os filtros viram WHERE (status, category, duration BETWEEN, insertion_date,
// expires_at >= hoje) e a busca de texto vira unaccent + ILIKE ou full-text search em português.
export class SearchOpenServicesUseCase {
  constructor(private readonly deps: SearchOpenServicesDeps) {}

  async execute(filters: JobFilters = {}): Promise<OpenService[]> {
    const now = this.deps.clock.now();
    const open = (await this.deps.services.find({ status: SERVICE_STATUS.PENDING })).filter((s) => !isExpired(s, now));
    const reputations = await this.deps.reputation.forFarms(open.map((s) => s.farm_id));
    const withFarm = await Promise.all(open.map(async (s): Promise<OpenService> => {
      const job = await toOpenService(this.deps.farms, s);
      const reputation = reputations.get(s.farm_id);
      return reputation ? { ...job, farm: { ...job.farm, reputation } } : job;
    }));

    const rejectedServiceIds = filters.worker_id === undefined
      ? new Set<number>()
      : new Set(
          (await this.deps.applications.find({ worker_id: filters.worker_id, status: APPLICATION_STATUS.REJECTED }))
            .map((a) => a.service_id)
        );

    const terms = searchable(filters.q ?? '').split(/\s+/).filter(Boolean);
    const result = withFarm.filter((job) => {
      if (rejectedServiceIds.has(job.id)) return false;
      if (filters.category && job.category !== filters.category) return false;
      if (filters.min_rating !== undefined && (job.farm.reputation?.average ?? 0) < filters.min_rating) return false;
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

    return result.sort(SORTERS[filters.sort ?? 'recent']);
  }
}
