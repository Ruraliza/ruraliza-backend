import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { NotificationRepository } from '../domain/notification';

export function createPgNotificationRepository(db: Database): NotificationRepository {
  return new PgRepository(db, 'notifications', {
    role: 'value', profile_id: 'value', title: 'value', body: 'value', url: 'value', count: 'value', read: 'value', insertion_date: 'value'
  }, ['role', 'profile_id', 'read', 'url']);
}
