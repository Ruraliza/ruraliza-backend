import type { Repository } from '#shared/domain/repository';
import type { Payment } from '../hiring.contract';

export type PaymentRepository = Repository<Payment, 'service_id'>;
