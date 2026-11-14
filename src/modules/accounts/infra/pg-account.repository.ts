import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { AccountRepository } from '../domain/account';

export function createPgAccountRepository(db: Database): AccountRepository {
  return new PgRepository(db, 'accounts', {
    email: 'value', password_hash: 'value', reset_token_digest: 'value', reset_expires_at: 'value', farmer_id: 'value', worker_id: 'value',
    last_role: 'value', terms_version: 'value?', terms_accepted_at: 'value?', preferences: 'json?'
  }, ['email', 'farmer_id', 'worker_id', 'reset_token_digest']);
}
