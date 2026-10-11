import type { AccountRepository } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository, PaymentRepository } from '#modules/hiring';
import type { PushSubscriptionRepository } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { SystemUserRepository } from '#modules/system-users';
import type { WorkerRepository } from '#modules/workers';

// Agregado transitório dos repositórios ainda não migrados para src/modules/<módulo>/domain.
// Some quando o último módulo migrar (cada um passa a declarar o seu).


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
