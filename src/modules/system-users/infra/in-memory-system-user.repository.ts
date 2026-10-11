import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { SystemUserRepository } from '../domain/system-user';

export function createInMemorySystemUserRepository(): SystemUserRepository {
  return new InMemoryRepository(['email'], (data, id) => ({ id, ...data }));
}
