import type { Repository } from '#shared/domain/repository';
import type { Worker } from '../worker.contract';

// TODO(db): e-mail e cpf viram restrições UNIQUE da tabela.
export type WorkerRepository = Repository<Worker, 'email' | 'cpf'>;
