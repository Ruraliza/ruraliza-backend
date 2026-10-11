import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import type { FarmReviewRepository, WorkerReviewRepository } from '../domain/review.repository';

export interface RemoveReviewsDeps {
  workerReviews: WorkerReviewRepository;
  farmReviews: FarmReviewRepository;
}

// Ao remover um perfil, saem as avaliações em que ele aparece (escritas ou recebidas): os serviços
// e as fazendas do produtor também somem, então a avaliação perderia o contexto.
// TODO(db): ON DELETE CASCADE nas chaves farmer_id/worker_id.
export function reviewsCleanup({ workerReviews, farmReviews }: RemoveReviewsDeps): ProfileCleanup {
  return {
    async farmerRemoved(farmerId) {
      for (const r of await workerReviews.find({ farmer_id: farmerId })) await workerReviews.delete(r.id);
      for (const r of await farmReviews.find({ farmer_id: farmerId })) await farmReviews.delete(r.id);
    },
    async workerRemoved(workerId) {
      for (const r of await workerReviews.find({ worker_id: workerId })) await workerReviews.delete(r.id);
      for (const r of await farmReviews.find({ worker_id: workerId })) await farmReviews.delete(r.id);
    }
  };
}
