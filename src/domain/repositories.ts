import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository, PaymentRepository } from '#modules/hiring';
import type { PushSubscriptionRepository } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { Repository } from '#shared/domain/repository';
import type { Farmer, Worker } from '../contracts';
import type { Account } from './passwords';
import type { SystemUserRecord } from './system-users';

// Agregado transitório dos repositórios ainda não migrados para src/modules/<módulo>/domain.
// Some quando o último módulo migrar (cada um passa a declarar o seu).

// TODO(db): e-mail e cpf viram restrições UNIQUE por tabela de perfil.
export type FarmerRepository = Repository<Farmer, 'email' | 'cpf'>;
export type WorkerRepository = Repository<Worker, 'email' | 'cpf'>;
// TODO(db): restrições UNIQUE (email), (farmer_id) e (worker_id).
export type AccountRepository = Repository<Account, 'email' | 'farmer_id' | 'worker_id' | 'reset_token_digest'>;
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
