import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { CertificateRepository } from '../domain/certificate';
import type { EnrollmentRepository } from '../domain/enrollment';
import type { TrackRepository } from '../domain/track';

export function createInMemoryTrackRepository(): TrackRepository {
  return new InMemoryRepository(['status'], (data, id) => ({ id, ...data }));
}

export function createInMemoryEnrollmentRepository(): EnrollmentRepository {
  return new InMemoryRepository(['track_id', 'worker_id'], (data, id) => ({ id, ...data }));
}

export function createInMemoryCertificateRepository(): CertificateRepository {
  return new InMemoryRepository(['code', 'worker_id', 'track_id'], (data, id) => ({ id, ...data }));
}
