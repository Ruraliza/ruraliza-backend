import type { Repository } from '#shared/domain/repository';
import type { Worker } from '../worker.contract';

// E-mail e CPF são UNIQUE na tabela `workers`.
export type WorkerRepository = Repository<Worker, 'email' | 'cpf'>;
