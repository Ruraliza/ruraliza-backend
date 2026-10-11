import type { AccessPolicies } from '#modules/auth';
import type { FarmRepository } from '#modules/farms';
import type { PaymentRepository } from '#modules/hiring';
import type { PushNotifier } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import { GetReputationUseCase } from './application/get-reputation.usecase';
import { GetServiceReviewsUseCase } from './application/get-service-reviews.usecase';
import { ListPendingReviewsUseCase } from './application/list-pending-reviews.usecase';
import { reviewsCleanup } from './application/remove-reviews';
import { SubmitFarmReviewUseCase, SubmitWorkerReviewUseCase } from './application/submit-review.usecase';
import type { FarmReviewRepository, WorkerReviewRepository } from './domain/review.repository';
import { createReviewController } from './presentation/review.controller';
import { type ReviewRoutes, reviewRoutes } from './presentation/review.routes';

export interface ReviewsModuleDeps {
  services: ServiceRepository;
  payments: PaymentRepository;
  farms: FarmRepository;
  workers: WorkerRepository;
  workerReviews: WorkerReviewRepository;
  farmReviews: FarmReviewRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

export interface ReviewUseCases {
  submitWorkerReview: SubmitWorkerReviewUseCase;
  submitFarmReview: SubmitFarmReviewUseCase;
  getServiceReviews: GetServiceReviewsUseCase;
  listPendingReviews: ListPendingReviewsUseCase;
  getReputation: GetReputationUseCase;
  // Apaga as avaliações de um perfil removido (ligado em DeleteFarmer/DeleteWorker pelo container).
  cleanup: ProfileCleanup;
}

// Casos de uso das avaliações (montados pelo container).
export function createReviewUseCases(deps: ReviewsModuleDeps): ReviewUseCases {
  return {
    submitWorkerReview: new SubmitWorkerReviewUseCase(deps),
    submitFarmReview: new SubmitFarmReviewUseCase(deps),
    getServiceReviews: new GetServiceReviewsUseCase(deps),
    listPendingReviews: new ListPendingReviewsUseCase(deps),
    getReputation: new GetReputationUseCase(deps),
    cleanup: reviewsCleanup(deps)
  };
}

// Rotas HTTP (produtor em /api/farmers, trabalhador em /api/workers, reputação em /api/reviews).
export function createReviewRoutes(useCases: ReviewUseCases, access: AccessPolicies): ReviewRoutes {
  return reviewRoutes(createReviewController(useCases), access);
}
