import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { SponsorRepository } from '../domain/sponsor';

export function createInMemorySponsorRepository(): SponsorRepository {
  return new InMemoryRepository(['active', 'audience'], (data, id) => ({ id, ...data }));
}
