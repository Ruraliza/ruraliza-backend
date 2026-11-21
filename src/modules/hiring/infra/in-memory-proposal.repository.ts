import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { ProposalRepository } from '../domain/proposal.repository';

export function createInMemoryProposalRepository(): ProposalRepository {
  return new InMemoryRepository(['application_id', 'service_id', 'worker_id', 'status'], (data, id) => ({ id, ...data }));
}
