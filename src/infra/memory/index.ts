import { createInMemoryAccountRepository } from '#modules/accounts';
import { createInMemoryFarmerRepository } from '#modules/farmers';
import { createInMemoryFarmRepository } from '#modules/farms';
import { createInMemoryApplicationRepository, createInMemoryPaymentRepository } from '#modules/hiring';
import { createInMemoryPushSubscriptionRepository } from '#modules/notifications';
import { createInMemoryServiceRepository } from '#modules/services';
import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { Repositories } from '../../domain/repositories';

// Repositórios em memória (um conjunto novo por chamada, isolado dos outros).
export function createInMemoryRepositories(): Repositories {
  return {
    farmers: createInMemoryFarmerRepository(),
    workers: new InMemoryRepository(['email', 'cpf'], (data, id) => ({ id, ...data })),
    farms: createInMemoryFarmRepository(),
    services: createInMemoryServiceRepository(),
    applications: createInMemoryApplicationRepository(),
    payments: createInMemoryPaymentRepository(),
    accounts: createInMemoryAccountRepository(),
    pushSubscriptions: createInMemoryPushSubscriptionRepository(),
    systemUsers: new InMemoryRepository(['email'], (data, id) => ({ id, ...data }))
  };
}
