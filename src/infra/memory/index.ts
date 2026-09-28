import type { Repositories } from '../../domain/repositories';
import { InMemoryRepository } from './InMemoryRepository';

// Repositórios em memória (um conjunto novo por chamada, isolado dos outros).
export function createInMemoryRepositories(): Repositories {
  return {
    farmers: new InMemoryRepository(['email', 'cpf'], (data, id) => ({ id, ...data })),
    workers: new InMemoryRepository(['email', 'cpf'], (data, id) => ({ id, ...data })),
    farms: new InMemoryRepository(['farmer_id'], (data, id) => ({ id, ...data })),
    services: new InMemoryRepository(['farmer_id', 'worker_id', 'farm_id', 'status'], (data, id) => ({ id, ...data })),
    applications: new InMemoryRepository(['service_id', 'worker_id', 'status'], (data, id) => ({ id, ...data })),
    payments: new InMemoryRepository(['service_id'], (data, id) => ({ id, ...data }))
  };
}
