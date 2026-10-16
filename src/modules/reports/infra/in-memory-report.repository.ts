import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { ReportRepository } from '../domain/report';

export function createInMemoryReportRepository(): ReportRepository {
  return new InMemoryRepository(['status', 'reporter_role', 'reporter_id', 'target_type', 'target_id'], (data, id) => ({ id, ...data }));
}
