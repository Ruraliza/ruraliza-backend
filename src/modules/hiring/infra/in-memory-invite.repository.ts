import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { InviteRepository } from '../domain/invite.repository';

export function createInMemoryInviteRepository(): InviteRepository {
  return new InMemoryRepository(['service_id', 'worker_id', 'farmer_id', 'status'], (data, id) => ({ id, ...data }));
}
