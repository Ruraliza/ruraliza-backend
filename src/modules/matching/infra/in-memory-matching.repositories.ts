import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { JobAlertRepository } from '../domain/job-alert';
import type { JobPreferencesRepository } from '../domain/job-preferences';

export function createInMemoryJobPreferencesRepository(): JobPreferencesRepository {
  return new InMemoryRepository(['worker_id', 'alerts'], (data, id) => ({ id, ...data }));
}

export function createInMemoryJobAlertRepository(): JobAlertRepository {
  return new InMemoryRepository(['worker_id', 'service_id'], (data, id) => ({ id, ...data }));
}
