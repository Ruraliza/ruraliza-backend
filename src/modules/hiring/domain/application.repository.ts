import type { Repository } from '#shared/domain/repository';
import type { ServiceApplication } from '../hiring.contract';

// TODO(db): restrição UNIQUE (service_id, worker_id).
export type ApplicationRepository = Repository<ServiceApplication, 'service_id' | 'worker_id' | 'status'>;
