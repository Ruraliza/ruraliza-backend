import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { ServiceRepository } from '../domain/service.repository';

export function createPgServiceRepository(db: Database): ServiceRepository {
  return new PgRepository(db, 'services', {
    farmer_id: 'value', farm_id: 'value', payment_id: 'value', worker_id: 'value', proposal_id: 'value', agreement: 'json', name: 'value', description: 'value', category: 'value',
    duration: 'value', price: 'value', price_unit: 'value', expires_at: 'value', status: 'value', completed_at: 'value', insertion_date: 'value'
  }, ['farmer_id', 'worker_id', 'farm_id', 'status']);
}
