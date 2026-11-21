import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { ProposalRepository } from '../domain/proposal.repository';

export function createPgProposalRepository(db: Database): ProposalRepository {
  return new PgRepository(db, 'proposals', {
    application_id: 'value', service_id: 'value', farmer_id: 'value', worker_id: 'value', amount: 'value', unit: 'value', notes: 'value', proposed_by: 'value', status: 'value',
    insertion_date: 'value', answered_at: 'value'
  }, ['application_id', 'service_id', 'worker_id', 'status']);
}
