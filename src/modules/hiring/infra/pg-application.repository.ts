import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { ApplicationRepository } from '../domain/application.repository';

export function createPgApplicationRepository(db: Database): ApplicationRepository {
  return new PgRepository(db, 'applications', {
    service_id: 'value', worker_id: 'value', status: 'value', auto_rejected: 'value?', insertion_date: 'value'
  }, ['service_id', 'worker_id', 'status']);
}
