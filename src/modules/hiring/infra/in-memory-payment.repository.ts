import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { PaymentRepository } from '../domain/payment.repository';

export function createInMemoryPaymentRepository(): PaymentRepository {
  return new InMemoryRepository(['service_id'], (data, id) => ({ id, ...data }));
}
