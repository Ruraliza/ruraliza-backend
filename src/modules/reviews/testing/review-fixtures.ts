import { type Farm, createInMemoryFarmRepository } from '#modules/farms';
import { createInMemoryPaymentRepository } from '#modules/hiring';
import { type Service, createInMemoryServiceRepository } from '#modules/services';
import { type Worker, createInMemoryWorkerRepository } from '#modules/workers';
import type { ChangeTopic } from '#shared/domain/changes';
import { type SentPush, adjustableClock, recordingChangeFeed, recordingPush } from '#shared/testing/recorders';
import { createInMemoryFarmReviewRepository, createInMemoryWorkerReviewRepository } from '../infra/in-memory-review.repositories';
import type { ReviewsModuleDeps } from '../reviews.module';

// Dependências das avaliações em memória, com relógio ajustável e avisos/pushes gravados; e um
// serviço concluído (pago em PAID_AT) pronto para ser avaliado.

export const PAID_AT = '2026-09-30T15:00:00.000Z';
export const FARMER_ID = 1;

export interface ReviewsTestbed extends ReviewsModuleDeps {
  setNow(iso: string): void;
  published: ChangeTopic[][];
  pushes: SentPush[];
}

export function reviewsTestbed(): ReviewsTestbed {
  const clock = adjustableClock(PAID_AT);
  const changes = recordingChangeFeed();
  const push = recordingPush();
  return {
    services: createInMemoryServiceRepository(),
    payments: createInMemoryPaymentRepository(),
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
    photos: [], insertion_date: PAID_AT, ...changes
  });
}

export function givenWorker(t: ReviewsTestbed, name = 'Maria Silva'): Promise<Worker> {
  return t.workers.create({
    email: 'maria@exemplo.com', name, phone: '24988887766', cpf: '11144477735',
    bio: null, certificates: null, courses: null, experience: null, photo_url: null, resume_url: null, insertion_date: PAID_AT
  });
}

// Serviço concluído pelo trabalhador, com o pagamento registrado em `paidAt`.
export async function givenCompletedService(t: ReviewsTestbed, farm: Farm, worker: Worker, paidAt = PAID_AT, changes: Partial<Service> = {}): Promise<Service> {
  const service = await t.services.create({
    farmer_id: FARMER_ID, farm_id: farm.id, payment_id: null, worker_id: worker.id,
    name: 'Colheita de café', description: null, category: 'Colheita', duration: 8, price: 400,
    expires_at: null, status: 'Completed', insertion_date: paidAt, ...changes
  });
  const payment = await t.payments.create({
    service_id: service.id, farmer_id: FARMER_ID, worker_id: worker.id, value: service.price, status: 'Completed', insertion_date: paidAt
  });
  const paid = { ...service, payment_id: payment.id };
  await t.services.update(paid);
  return paid;
}
