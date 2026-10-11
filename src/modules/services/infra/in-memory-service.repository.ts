import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { ServiceRepository } from '../domain/service.repository';

export function createInMemoryServiceRepository(): ServiceRepository {
  return new InMemoryRepository(['farmer_id', 'worker_id', 'farm_id', 'status'], (data, id) => ({ id, ...data }));
}
