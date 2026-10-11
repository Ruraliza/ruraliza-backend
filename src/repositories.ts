import { createInMemoryAccountRepository } from '#modules/accounts';
import type { AccountRepository } from '#modules/accounts';
import { createInMemoryFarmerRepository } from '#modules/farmers';
import type { FarmerRepository } from '#modules/farmers';
import { createInMemoryFarmRepository } from '#modules/farms';
import type { FarmRepository } from '#modules/farms';
import { createInMemoryApplicationRepository, createInMemoryPaymentRepository } from '#modules/hiring';
import type { ApplicationRepository, PaymentRepository } from '#modules/hiring';
import { createInMemoryPushSubscriptionRepository } from '#modules/notifications';
import type { PushSubscriptionRepository } from '#modules/notifications';
import { createInMemoryServiceRepository } from '#modules/services';
import type { ServiceRepository } from '#modules/services';
import { type SystemUserRepository, createInMemorySystemUserRepository } from '#modules/system-users';
import {
  type CertificateRepository,
  type EnrollmentRepository,
  type TrackRepository,
  createInMemoryCertificateRepository,
  createInMemoryEnrollmentRepository,
  createInMemoryTrackRepository
} from '#modules/tracks';
import { type WorkerRepository, createInMemoryWorkerRepository } from '#modules/workers';

// Todos os repositórios da API (cada módulo declara a sua porta em src/modules/<módulo>/domain).
// A troca de persistência é passar outro `Repositories` em createContainer({ repos }).


export interface Repositories {
  farmers: FarmerRepository;
  workers: WorkerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  payments: PaymentRepository;
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  systemUsers: SystemUserRepository;
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  certificates: CertificateRepository;
}

// Repositórios em memória (um conjunto novo por chamada, isolado dos outros).
export function createInMemoryRepositories(): Repositories {
  return {
    farmers: createInMemoryFarmerRepository(),
    workers: createInMemoryWorkerRepository(),
    farms: createInMemoryFarmRepository(),
    services: createInMemoryServiceRepository(),
    applications: createInMemoryApplicationRepository(),
    payments: createInMemoryPaymentRepository(),
    accounts: createInMemoryAccountRepository(),
    pushSubscriptions: createInMemoryPushSubscriptionRepository(),
    systemUsers: createInMemorySystemUserRepository(),
    tracks: createInMemoryTrackRepository(),
    enrollments: createInMemoryEnrollmentRepository(),
    certificates: createInMemoryCertificateRepository()
  };
}
