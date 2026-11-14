import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { VerificationRepository } from '../domain/verification';

export function createPgVerificationRepository(db: Database): VerificationRepository {
  return new PgRepository(db, 'verifications', {
    role: 'value', profile_id: 'value', document_type: 'value', document_id: 'value', status: 'value', submitted_at: 'value', reviewed_at: 'value',
    rejection_reason: 'value', verified_name: 'value'
  }, ['role', 'profile_id', 'status']);
}
