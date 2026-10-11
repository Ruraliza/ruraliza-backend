import type { Repository } from '#shared/domain/repository';
import type { Farmer } from '../farmer.contract';

// TODO(db): e-mail e cpf viram restrições UNIQUE da tabela.
export type FarmerRepository = Repository<Farmer, 'email' | 'cpf'>;
