import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { FarmRepository } from '../domain/farm.repository';

export function createInMemoryFarmRepository(): FarmRepository {
  return new InMemoryRepository(['farmer_id'], (data, id) => ({ id, ...data }));
}
