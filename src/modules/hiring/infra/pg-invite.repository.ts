import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { InviteRepository } from '../domain/invite.repository';

export function createPgInviteRepository(db: Database): InviteRepository {
  return new PgRepository(db, 'invites', {
    service_id: 'value', farmer_id: 'value', worker_id: 'value', status: 'value', insertion_date: 'value', answered_at: 'value'
  }, ['service_id', 'worker_id', 'farmer_id', 'status']);
}
