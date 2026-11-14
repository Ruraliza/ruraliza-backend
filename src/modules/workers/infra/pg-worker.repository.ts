import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { WorkerRepository } from '../domain/worker.repository';

export function createPgWorkerRepository(db: Database): WorkerRepository {
  return new PgRepository(db, 'workers', {
    email: 'value', name: 'value', bio: 'value', certificates: 'value', courses: 'value', experience: 'value', phone: 'value', cpf: 'value',
    photo_url: 'value', resume_url: 'value', insertion_date: 'value'
  }, ['email', 'cpf']);
}
