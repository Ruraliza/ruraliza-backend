import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { JobAlertRepository } from '../domain/job-alert';
import type { JobPreferencesRepository } from '../domain/job-preferences';

export function createPgJobPreferencesRepository(db: Database): JobPreferencesRepository {
  return new PgRepository(db, 'job_preferences', {
    worker_id: 'value', categories: 'value', near: 'json', alerts: 'value', last_digest_at: 'value'
  }, ['worker_id', 'alerts']);
}

export function createPgJobAlertRepository(db: Database): JobAlertRepository {
  return new PgRepository(db, 'job_alerts', {
    worker_id: 'value', service_id: 'value', sent_at: 'value'
  }, ['worker_id', 'service_id']);
}
