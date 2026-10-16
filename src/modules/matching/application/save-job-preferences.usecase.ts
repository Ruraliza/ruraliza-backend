import { type Result, notFound, ok } from '#shared/domain/result';
import { COORDINATE_DECIMALS } from '../domain/job-preferences';
import type { JobPreferences } from '../matching.contract';
import { type MatchingDeps, findPreferences } from './matching-deps';

const round = (value: number): number => Number(value.toFixed(COORDINATE_DECIMALS));

// Troca as preferências. A região fica arredondada (cerca de 1 km). Ligar os avisos marca o início da
// contagem do resumo semanal, para o primeiro não chegar no mesmo dia.
export class SaveJobPreferencesUseCase {
  constructor(private readonly deps: MatchingDeps) {}

  async execute({ workerId, input }: { workerId: number; input: JobPreferences }): Promise<Result<JobPreferences>> {
    const { jobPreferences, workers, clock } = this.deps;
    if (!(await workers.findById(workerId))) return notFound('Trabalhador não encontrado.');
    const current = await findPreferences(this.deps, workerId);
    const preferences: JobPreferences = {
      categories: [...new Set(input.categories)],
      near: input.near && { latitude: round(input.near.latitude), longitude: round(input.near.longitude), radius_km: input.near.radius_km },
      alerts: input.alerts
    };
    const turnedOn = preferences.alerts && !current?.alerts;
    const lastDigest = turnedOn ? clock.now() : current?.last_digest_at ?? null;
    if (current) await jobPreferences.update({ ...current, ...preferences, last_digest_at: lastDigest });
    else await jobPreferences.create({ worker_id: workerId, ...preferences, last_digest_at: lastDigest });
    return ok(preferences);
  }
}
