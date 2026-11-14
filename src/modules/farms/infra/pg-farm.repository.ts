import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { FarmRepository } from '../domain/farm.repository';

export function createPgFarmRepository(db: Database): FarmRepository {
  return new PgRepository(db, 'farms', {
    farmer_id: 'value', address: 'value', city: 'value', state: 'value', latitude: 'value', longitude: 'value', photos: 'json',
    insertion_date: 'value', deleted_at: 'value?'
  }, ['farmer_id']);
}
