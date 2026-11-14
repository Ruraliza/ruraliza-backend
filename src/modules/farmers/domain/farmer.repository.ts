import type { Repository } from '#shared/domain/repository';
import type { Farmer } from '../farmer.contract';

// E-mail e CPF são UNIQUE na tabela `farmers`.
export type FarmerRepository = Repository<Farmer, 'email' | 'cpf'>;
