import type { Repository } from '#shared/domain/repository';
import type { Invite } from '../hiring.contract';

// Tabela `invites`: UNIQUE (service_id, worker_id).
export type InviteRepository = Repository<Invite, 'service_id' | 'worker_id' | 'farmer_id' | 'status'>;
