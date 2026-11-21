import type { Repository } from '#shared/domain/repository';
import type { JobPreferences } from '../matching.contract';

// Preferências de vaga de um trabalhador (uma por trabalhador).
// Tabela `job_preferences`, com UNIQUE (worker_id); a região (`near`) vai em jsonb.
export interface JobPreferencesRecord extends JobPreferences {
  id: number;
  worker_id: number;
  last_digest_at: string | null; // último resumo semanal (ou quando os avisos foram ligados)
}

export type JobPreferencesRepository = Repository<JobPreferencesRecord, 'worker_id' | 'alerts' | 'catalog'>;

// O catálogo começa ligado (também para quem nunca salvou preferências); só entra quem escolheu a categoria da vaga.
export const DEFAULT_JOB_PREFERENCES: JobPreferences = { categories: [], near: null, alerts: false, catalog: true };
export const RADIUS_MIN_KM = 5;
export const RADIUS_MAX_KM = 300;
// O app guarda só a região (2 casas decimais: cerca de 1 km), nunca o ponto exato.
export const COORDINATE_DECIMALS = 2;

export function toJobPreferences(record: JobPreferencesRecord | undefined): JobPreferences {
  if (!record) return DEFAULT_JOB_PREFERENCES;
  const { categories, near, alerts, catalog } = record;
  return { categories, near, alerts, catalog };
}
