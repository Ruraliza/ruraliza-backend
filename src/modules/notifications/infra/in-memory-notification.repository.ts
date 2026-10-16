import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { NotificationRepository } from '../domain/notification';

export function createInMemoryNotificationRepository(): NotificationRepository {
  return new InMemoryRepository(['role', 'profile_id', 'read', 'url'], (data, id) => ({ id, ...data }));
}
