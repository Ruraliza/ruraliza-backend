import { createInMemoryFarmRepository } from '#modules/farms';
import { createInMemoryApplicationRepository, createInMemoryPaymentRepository } from '#modules/hiring';
import { createInMemoryServiceRepository } from '#modules/services';
import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { Repositories } from '../../domain/repositories';

// Repositórios em memória (um conjunto novo por chamada, isolado dos outros).
export function createInMemoryRepositories(): Repositories {
  return {
    farmers: new InMemoryRepository(['email', 'cpf'], (data, id) => ({ id, ...data })),
    workers: new InMemoryRepository(['email', 'cpf'], (data, id) => ({ id, ...data })),
    farms: createInMemoryFarmRepository(),
    services: createInMemoryServiceRepository(),
    applications: createInMemoryApplicationRepository(),
    payments: createInMemoryPaymentRepository(),
    accounts: new InMemoryRepository(['email', 'farmer_id', 'worker_id', 'reset_token_digest'], (data, id) => ({ id, ...data })),
    pushSubscriptions: new InMemoryRepository(['account_id', 'endpoint'], (data, id) => ({ id, ...data })),
    systemUsers: new InMemoryRepository(['email'], (data, id) => ({ id, ...data }))
  };
}
