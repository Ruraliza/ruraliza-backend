import type { Repository } from '#shared/domain/repository';
import type { Service } from '../service.contract';

export type ServiceRepository = Repository<Service, 'farmer_id' | 'worker_id' | 'farm_id' | 'status'>;
