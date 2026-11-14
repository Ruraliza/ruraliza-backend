import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { FarmerRepository } from '../domain/farmer.repository';

export function createPgFarmerRepository(db: Database): FarmerRepository {
  return new PgRepository(db, 'farmers', {
    email: 'value', name: 'value', farms: 'value', phone: 'value', cpf: 'value', photo_url: 'value', insertion_date: 'value'
  }, ['email', 'cpf']);
}
