import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { PushSubscriptionRepository } from '../domain/push-subscription.repository';

export function createPgPushSubscriptionRepository(db: Database): PushSubscriptionRepository {
  return new PgRepository(db, 'push_subscriptions', {
    account_id: 'value', endpoint: 'value', p256dh: 'value', auth: 'value', insertion_date: 'value'
  }, ['account_id', 'endpoint']);
}
