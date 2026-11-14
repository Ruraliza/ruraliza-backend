import type { Repository } from '#shared/domain/repository';
import type { ServiceApplication } from '../hiring.contract';

// Tabela `applications`: UNIQUE (service_id, worker_id) e no máximo uma candidatura aceita por serviço.
export type ApplicationRepository = Repository<ServiceApplication, 'service_id' | 'worker_id' | 'status'>;
