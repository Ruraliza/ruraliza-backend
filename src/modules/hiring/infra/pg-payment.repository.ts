import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { PaymentRepository } from '../domain/payment.repository';

export function createPgPaymentRepository(db: Database): PaymentRepository {
  return new PgRepository(db, 'payments', {
    service_id: 'value', farmer_id: 'value', worker_id: 'value', value: 'value', status: 'value', insertion_date: 'value'
  }, ['service_id']);
}
