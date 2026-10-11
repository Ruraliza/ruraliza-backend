import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { ApplicationRepository } from '../domain/application.repository';

export function createInMemoryApplicationRepository(): ApplicationRepository {
  return new InMemoryRepository(['service_id', 'worker_id', 'status'], (data, id) => ({ id, ...data }));
}
