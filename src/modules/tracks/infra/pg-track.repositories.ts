import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { CertificateRepository } from '../domain/certificate';
import type { EnrollmentRepository } from '../domain/enrollment';
import type { TrackRepository } from '../domain/track';

export function createPgTrackRepository(db: Database): TrackRepository {
  return new PgRepository(db, 'tracks', {
    title: 'value', description: 'value', categories: 'value', tutor_ids: 'value', status: 'value', modules: 'json', last_item_id: 'value',
    created_by: 'value', insertion_date: 'value', updated_at: 'value', published_at: 'value'
  }, ['status']);
}

export function createPgEnrollmentRepository(db: Database): EnrollmentRepository {
  return new PgRepository(db, 'enrollments', {
    track_id: 'value', worker_id: 'value', completed_lesson_ids: 'value', last_lesson_id: 'value', started_at: 'value', completed_at: 'value'
  }, ['track_id', 'worker_id']);
}

export function createPgCertificateRepository(db: Database): CertificateRepository {
  return new PgRepository(db, 'certificates', {
    code: 'value', track_id: 'value', track_title: 'value', worker_name: 'value', workload_minutes: 'value', completed_at: 'value',
    data_hash: 'value', worker_id: 'value', issued_at: 'value'
  }, ['code', 'worker_id', 'track_id']);
}
