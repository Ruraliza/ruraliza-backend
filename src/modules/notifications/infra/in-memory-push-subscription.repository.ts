import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { PushSubscriptionRepository } from '../domain/push-subscription.repository';

export function createInMemoryPushSubscriptionRepository(): PushSubscriptionRepository {
  return new InMemoryRepository(['account_id', 'endpoint'], (data, id) => ({ id, ...data }));
}
