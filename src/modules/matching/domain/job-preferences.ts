import type { Repository } from '#shared/domain/repository';
import type { JobPreferences } from '../matching.contract';

// Preferências de vaga de um trabalhador (uma por trabalhador).
// TODO(db): tabela `job_preferences (worker_id PK, categories text[], latitude, longitude, radius_km, alerts,
// last_digest_at)`.
export interface JobPreferencesRecord extends JobPreferences {
  id: number;
  worker_id: number;
  last_digest_at: string | null; // último resumo semanal (ou quando os avisos foram ligados)
}

export type JobPreferencesRepository = Repository<JobPreferencesRecord, 'worker_id' | 'alerts'>;

export const DEFAULT_JOB_PREFERENCES: JobPreferences = { categories: [], near: null, alerts: false };
export const RADIUS_MIN_KM = 5;
export const RADIUS_MAX_KM = 300;
// O app guarda só a região (2 casas decimais: cerca de 1 km), nunca o ponto exato.
export const COORDINATE_DECIMALS = 2;

export function toJobPreferences(record: JobPreferencesRecord | undefined): JobPreferences {
  if (!record) return DEFAULT_JOB_PREFERENCES;
  const { categories, near, alerts } = record;
  return { categories, near, alerts };
}
