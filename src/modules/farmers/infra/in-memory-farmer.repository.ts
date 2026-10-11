import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { FarmerRepository } from '../domain/farmer.repository';

export function createInMemoryFarmerRepository(): FarmerRepository {
  return new InMemoryRepository(['email', 'cpf'], (data, id) => ({ id, ...data }));
}
