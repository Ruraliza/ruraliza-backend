import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { WorkerRepository } from '../domain/worker.repository';

export function createInMemoryWorkerRepository(): WorkerRepository {
  return new InMemoryRepository(['email', 'cpf'], (data, id) => ({ id, ...data }));
}
