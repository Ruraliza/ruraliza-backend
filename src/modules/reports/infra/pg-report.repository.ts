import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { ReportRepository } from '../domain/report';

export function createPgReportRepository(db: Database): ReportRepository {
  return new PgRepository(db, 'reports', {
    target_type: 'value', target_id: 'value', reason: 'value', details: 'value', status: 'value', insertion_date: 'value', reporter_role: 'value',
    reporter_id: 'value', resolution_note: 'value', reviewed_at: 'value'
  }, ['status', 'reporter_role', 'reporter_id', 'target_type', 'target_id']);
}
