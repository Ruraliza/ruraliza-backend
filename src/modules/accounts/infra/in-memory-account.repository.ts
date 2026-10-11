import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { AccountRepository } from '../domain/account';

export function createInMemoryAccountRepository(): AccountRepository {
  return new InMemoryRepository(['email', 'farmer_id', 'worker_id', 'reset_token_digest'], (data, id) => ({ id, ...data }));
}
