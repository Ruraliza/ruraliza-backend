import type { Farm, Farmer, Payment, Service, ServiceApplication, Worker } from '../contracts';

// Acesso a dados que as regras de negócio enxergam. Tudo é assíncrono desde já:
// a implementação em memória e a futura em PostgreSQL cumprem a mesma interface.
//
// Semântica (igual à de um banco): cada leitura devolve uma cópia; alterar a entidade
// só tem efeito depois de `update`. `create` recebe os dados sem id e devolve a entidade com id.

// Filtro por igualdade nos campos permitidos (vira WHERE campo = valor no banco).
export type Criteria<T, K extends keyof T> = Partial<Pick<T, K>>;

export interface Repository<T extends { id: number }, K extends keyof T> {
  findById(id: number): Promise<T | undefined>;
  find(criteria?: Criteria<T, K>): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(entity: T): Promise<void>;
  delete(id: number): Promise<void>;
}

// TODO(db): e-mail e cpf viram restrições UNIQUE por tabela de perfil.
export type FarmerRepository = Repository<Farmer, 'email' | 'cpf'>;
export type WorkerRepository = Repository<Worker, 'email' | 'cpf'>;
export type FarmRepository = Repository<Farm, 'farmer_id'>;
export type ServiceRepository = Repository<Service, 'farmer_id' | 'worker_id' | 'farm_id' | 'status'>;
// TODO(db): restrição UNIQUE (service_id, worker_id).
export type ApplicationRepository = Repository<ServiceApplication, 'service_id' | 'worker_id' | 'status'>;
export type PaymentRepository = Repository<Payment, 'service_id'>;

export interface Repositories {
  farmers: FarmerRepository;
  workers: WorkerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  payments: PaymentRepository;
}
