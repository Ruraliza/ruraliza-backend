import { SERVICE_STATUS, type Service, isExpired, toOpenService } from '#modules/services';
import { type Result, notFound, ok } from '#shared/domain/result';
import { type JobMatch, matchJob } from '../domain/match';
import type { RecommendedJob } from '../matching.contract';
import { type MatchingDeps, interestsOf, ownFarmerId } from './matching-deps';

export const RECOMMENDATIONS_DEFAULT = 10;
export const RECOMMENDATIONS_MAX = 30;

// Vagas abertas que combinam com o trabalhador, da que mais combina para a que menos (empate: a mais
// recente). Ficam de fora as vagas em que ele já se candidatou e as do próprio perfil de produtor.
// Cada vaga diz por que foi sugerida.
export class RecommendJobsUseCase {
  constructor(private readonly deps: MatchingDeps) {}

  async execute({ workerId, limit = RECOMMENDATIONS_DEFAULT }: { workerId: number; limit?: number }): Promise<Result<RecommendedJob[]>> {
    const { services, farms, applications, clock, reputation, verification } = this.deps;
    if (!(await this.deps.workers.findById(workerId))) return notFound('Trabalhador não encontrado.');
    const interests = await interestsOf(this.deps, workerId);
    const applied = new Set((await applications.find({ worker_id: workerId })).map((a) => a.service_id));
    const own = await ownFarmerId(this.deps, workerId);
    const now = clock.now();
    const open = (await services.find({ status: SERVICE_STATUS.PENDING }))
      .filter((s) => !isExpired(s, now) && !applied.has(s.id) && s.farmer_id !== own);

    const reputations = await reputation.forFarms(open.map((s) => s.farm_id));
    const verified = await verification.verifiedFarmers(open.map((s) => s.farmer_id));
    const matches: { service: Service; match: JobMatch }[] = [];
    for (const service of open) {
      const farm = await farms.findById(service.farm_id);
      const match = matchJob(interests, {
        category: service.category,
        latitude: farm?.latitude ?? null,
        longitude: farm?.longitude ?? null,
        reputation: reputations.get(service.farm_id),
        farmerVerified: verified.has(service.farmer_id)
      });
      if (match) matches.push({ service, match });
    }
    matches.sort((a, b) => b.match.score - a.match.score || b.service.insertion_date.localeCompare(a.service.insertion_date) || b.service.id - a.service.id);

    const jobs = await Promise.all(matches.slice(0, limit).map(async ({ service, match }): Promise<RecommendedJob> => {
      const job = await toOpenService(farms, service);
      const rep = reputations.get(service.farm_id);
      const farm = { ...job.farm, ...(rep ? { reputation: rep } : {}), ...(verified.has(service.farmer_id) ? { farmer_verified: true as const } : {}) };
      return { ...job, farm, reasons: match.reasons, distance_km: match.distanceKm };
    }));
    return ok(jobs);
  }
}
