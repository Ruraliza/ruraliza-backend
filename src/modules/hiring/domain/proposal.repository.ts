import type { Repository } from '#shared/domain/repository';
import type { Proposal } from '../hiring.contract';

// Tabela `proposals`: no máximo uma pendente e uma aceita por candidatura (índices únicos parciais).
export type ProposalRepository = Repository<Proposal, 'application_id' | 'service_id' | 'worker_id' | 'status'>;
