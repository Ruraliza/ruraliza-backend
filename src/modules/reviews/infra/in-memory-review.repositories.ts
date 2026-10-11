import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { FarmReviewRepository, WorkerReviewRepository } from '../domain/review.repository';

export function createInMemoryWorkerReviewRepository(): WorkerReviewRepository {
  return new InMemoryRepository(['service_id', 'worker_id', 'farmer_id'], (data, id) => ({ id, ...data }));
}

export function createInMemoryFarmReviewRepository(): FarmReviewRepository {
  return new InMemoryRepository(['service_id', 'farm_id', 'worker_id', 'farmer_id'], (data, id) => ({ id, ...data }));
}
