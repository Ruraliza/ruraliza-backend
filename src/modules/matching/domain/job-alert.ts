import type { Repository } from '#shared/domain/repository';

// Aviso de vaga nova já mandado para um trabalhador: evita repetir a mesma vaga e segura o excesso.
// TODO(db): tabela `job_alerts (worker_id, service_id, sent_at)` com índice (worker_id, sent_at).
export interface JobAlertRecord {
  id: number;
  worker_id: number;
  service_id: number;
  sent_at: string;
}

export type JobAlertRepository = Repository<JobAlertRecord, 'worker_id' | 'service_id'>;

// No máximo 3 avisos de vaga nova por pessoa em 24 horas; o resto fica para as recomendações e o resumo.
export const MAX_ALERTS_PER_DAY = 3;
export const DIGEST_INTERVAL_DAYS = 7;
