import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { VerificationRepository } from '../domain/verification';

export function createInMemoryVerificationRepository(): VerificationRepository {
  return new InMemoryRepository(['role', 'profile_id', 'status'], (data, id) => ({ id, ...data }));
}
