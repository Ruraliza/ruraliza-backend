import type { Repository } from '#shared/domain/repository';
import type { FarmReview, WorkerReview } from '../reviews.contract';

// O que decide quando a avaliação aparece (fica só no banco, não sai na API).
export interface Visibility {
  window_ends_at: string; // fim do prazo para avaliar este serviço
  revealed: boolean; // os dois lados já avaliaram
}

export type WorkerReviewRecord = WorkerReview & Visibility;
export type FarmReviewRecord = FarmReview & Visibility;

// TODO(db): restrição UNIQUE (service_id) em cada tabela: uma avaliação de cada lado por serviço.
export type WorkerReviewRepository = Repository<WorkerReviewRecord, 'service_id' | 'worker_id' | 'farmer_id'>;
export type FarmReviewRepository = Repository<FarmReviewRecord, 'service_id' | 'farm_id' | 'worker_id' | 'farmer_id'>;
