// API pública do módulo de avaliações: o único arquivo que outros módulos enxergam (#modules/reviews).
export type * from './reviews.contract';
export type { FarmReviewRepository, WorkerReviewRepository } from './domain/review.repository';
export { REVIEW_WINDOW_DAYS, farmReputation, windowEndsAt, workerReputation } from './domain/review.rules';
export { createInMemoryFarmReviewRepository, createInMemoryWorkerReviewRepository } from './infra/in-memory-review.repositories';
export type { ReviewRoutes } from './presentation/review.routes';
export { type ReviewSchemaName, reviewSchemas } from './presentation/review.schemas';
export { type ReviewUseCases, type ReviewsModuleDeps, createReviewRoutes, createReviewUseCases } from './reviews.module';
