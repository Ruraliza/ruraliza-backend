import type { AccountRepository } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository, PaymentRepository } from '#modules/hiring';
import type { PushSubscriptionRepository } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { Repository } from '#shared/domain/repository';
import type { SystemUserRecord } from './system-users';

// Agregado transitório dos repositórios ainda não migrados para src/modules/<módulo>/domain.
// Some quando o último módulo migrar (cada um passa a declarar o seu).

// TODO(db): restrição UNIQUE (email).
export type SystemUserRepository = Repository<SystemUserRecord, 'email'>;

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
}
