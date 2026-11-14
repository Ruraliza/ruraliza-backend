import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { SystemUserRepository } from '../domain/system-user';

export function createPgSystemUserRepository(db: Database): SystemUserRepository {
  return new PgRepository(db, 'system_users', {
    email: 'value', name: 'value', role: 'value', password_hash: 'value', insertion_date: 'value'
  }, ['email']);
}
