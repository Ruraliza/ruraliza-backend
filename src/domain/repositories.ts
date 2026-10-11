import type { FarmRepository } from '#modules/farms';
import type { Farmer, Payment, Service, ServiceApplication, Worker } from '../contracts';
import type { Account } from './passwords';
import type { PushSubscriptionRecord } from './push';
import type { SystemUserRecord } from './system-users';
import type { Repository } from '#shared/domain/repository';

// Agregado transitório dos repositórios ainda não migrados para src/modules/<módulo>/domain.
// Some quando o último módulo migrar (cada um passa a declarar o seu).

// TODO(db): e-mail e cpf viram restrições UNIQUE por tabela de perfil.
export type FarmerRepository = Repository<Farmer, 'email' | 'cpf'>;
export type WorkerRepository = Repository<Worker, 'email' | 'cpf'>;
export type ServiceRepository = Repository<Service, 'farmer_id' | 'worker_id' | 'farm_id' | 'status'>;
// TODO(db): restrição UNIQUE (service_id, worker_id).
export type ApplicationRepository = Repository<ServiceApplication, 'service_id' | 'worker_id' | 'status'>;
export type PaymentRepository = Repository<Payment, 'service_id'>;
// TODO(db): restrições UNIQUE (email), (farmer_id) e (worker_id).
export type AccountRepository = Repository<Account, 'email' | 'farmer_id' | 'worker_id' | 'reset_token_digest'>;
export type PushSubscriptionRepository = Repository<PushSubscriptionRecord, 'account_id' | 'endpoint'>;
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
