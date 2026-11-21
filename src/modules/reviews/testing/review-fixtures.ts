import { type Farm, createInMemoryFarmRepository } from '#modules/farms';
import { type Service, createInMemoryServiceRepository } from '#modules/services';
import { type Worker, createInMemoryWorkerRepository } from '#modules/workers';
import type { ChangeTopic } from '#shared/domain/changes';
import { type SentPush, adjustableClock, recordingChangeFeed, recordingPush } from '#shared/testing/recorders';
import { createInMemoryFarmReviewRepository, createInMemoryWorkerReviewRepository } from '../infra/in-memory-review.repositories';
import type { ReviewsModuleDeps } from '../reviews.module';

// Dependências das avaliações em memória, com relógio ajustável e avisos/pushes gravados; e um
// serviço concluído (pago em DONE_AT) pronto para ser avaliado.

export const DONE_AT = '2026-09-30T15:00:00.000Z';
export const FARMER_ID = 1;

export interface ReviewsTestbed extends ReviewsModuleDeps {
  setNow(iso: string): void;
  published: ChangeTopic[][];
  pushes: SentPush[];
}

export function reviewsTestbed(): ReviewsTestbed {
  const clock = adjustableClock(DONE_AT);
  const changes = recordingChangeFeed();
  const push = recordingPush();
  return {
    services: createInMemoryServiceRepository(),
    farms: createInMemoryFarmRepository(),
    workers: createInMemoryWorkerRepository(),
    workerReviews: createInMemoryWorkerReviewRepository(),
    farmReviews: createInMemoryFarmReviewRepository(),
    clock,
    changes,
    push,
    setNow: clock.set,
    published: changes.published,
    pushes: push.sent
  };
}

export function givenFarm(t: ReviewsTestbed, changes: Partial<Farm> = {}): Promise<Farm> {
  return t.farms.create({
    farmer_id: FARMER_ID, address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: null, longitude: null,
    photos: [], insertion_date: DONE_AT, ...changes
  });
}

export function givenWorker(t: ReviewsTestbed, name = 'Maria Silva'): Promise<Worker> {
  return t.workers.create({
    email: 'maria@exemplo.com', name, phone: '24988887766', cpf: '11144477735',
    bio: null, certificates: null, courses: null, experience: null, photo_url: null, resume_url: null, insertion_date: DONE_AT
  });
}

// Serviço feito pelo trabalhador e pago (concluído) em `doneAt`.
export function givenCompletedService(t: ReviewsTestbed, farm: Farm, worker: Worker, doneAt = DONE_AT, changes: Partial<Service> = {}): Promise<Service> {
  return t.services.create({
    farmer_id: FARMER_ID, farm_id: farm.id, payment_id: null, proposal_id: null, agreement: null, completed_at: doneAt, price: 400, price_unit: 'fixed', worker_id: worker.id,
    name: 'Colheita de café', description: null, category: 'Colheita', duration: 8,
    expires_at: null, status: 'Completed', insertion_date: doneAt, ...changes
  });
}
