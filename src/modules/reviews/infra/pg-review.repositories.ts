import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { FarmReviewRepository, WorkerReviewRepository } from '../domain/review.repository';

export function createPgWorkerReviewRepository(db: Database): WorkerReviewRepository {
  return new PgRepository(db, 'worker_reviews', {
    service_id: 'value', farmer_id: 'value', worker_id: 'value', punctuality: 'value', effort: 'value', quality: 'value', comment: 'value',
    insertion_date: 'value', window_ends_at: 'value', revealed: 'value'
  }, ['service_id', 'worker_id', 'farmer_id']);
}

export function createPgFarmReviewRepository(db: Database): FarmReviewRepository {
  return new PgRepository(db, 'farm_reviews', {
    service_id: 'value', farm_id: 'value', farmer_id: 'value', worker_id: 'value', infrastructure: 'value', conditions: 'value',
    as_described: 'value', comment: 'value', insertion_date: 'value', window_ends_at: 'value', revealed: 'value'
  }, ['service_id', 'farm_id', 'worker_id', 'farmer_id']);
}
