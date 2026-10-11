import { createInMemoryAccountRepository } from '#modules/accounts';
import { workerReputation } from '#modules/reviews';
import { type Service, createInMemoryServiceRepository } from '#modules/services';
import { createInMemoryWorkerRepository } from '#modules/workers';
import type { Worker } from '#modules/workers';
import type { ChangeTopic } from '#shared/domain/changes';
import { type SentPush, adjustableClock, recordingChangeFeed, recordingPush } from '#shared/testing/recorders';
import type { ApplicationStatus, ServiceApplication } from '../hiring.contract';
import { NO_HIRING_EVENTS } from '../domain/hiring-events';
import type { HiringModuleDeps } from '../hiring.module';
import { createInMemoryApplicationRepository } from '../infra/in-memory-application.repository';
import { createInMemoryPaymentRepository } from '../infra/in-memory-payment.repository';

// Dependências dos casos de uso de contratação, todas em memória, com relógio ajustável e
// avisos (SSE) e pushes gravados; e dados mínimos para montar cada cenário.

// 30/09/2026 ao meio-dia em Brasília (15h UTC): "hoje" é 2026-09-30.
export const NOW = '2026-09-30T15:00:00.000Z';
export const FARMER_ID = 1;

export interface HiringTestbed extends HiringModuleDeps {
  setNow(iso: string): void;
  published: ChangeTopic[][];
  pushes: SentPush[];
}

export function hiringTestbed(): HiringTestbed {
  const workers = createInMemoryWorkerRepository();
  const accounts = createInMemoryAccountRepository();
  const clock = adjustableClock(NOW);
  const changes = recordingChangeFeed();
  const push = recordingPush();
  return {
    services: createInMemoryServiceRepository(),
    applications: createInMemoryApplicationRepository(),
    payments: createInMemoryPaymentRepository(),
    workers,
    accounts,
    clock,
    changes,
    push,
    events: NO_HIRING_EVENTS,
    // Sem avaliações: todo candidato sai com a reputação vazia.
    reputation: { forWorkers: (ids) => Promise.resolve(new Map(ids.map((id) => [id, workerReputation([])]))) },
    setNow: clock.set,
    published: changes.published,
    pushes: push.sent
  };
}

export function givenWorker(t: HiringTestbed, name = 'Maria'): Promise<Worker> {
  return t.workers.create({
    email: `${name.toLowerCase()}@exemplo.com`, name, phone: '1', cpf: '11144477735',
    bio: null, certificates: null, courses: null, experience: null, photo_url: null, resume_url: null, insertion_date: NOW
  });
}

// Serviço do produtor FARMER_ID (a fazenda não importa para a contratação).
export function givenService(t: HiringTestbed, changes: Partial<Service> = {}): Promise<Service> {
  return t.services.create({
    farmer_id: FARMER_ID, farm_id: 1, payment_id: null, worker_id: null,
    name: 'Capina', description: null, category: 'Manutenção', duration: 4, price: 200,
    expires_at: null, status: 'Pending', insertion_date: NOW, ...changes
  });
}

export function givenApplication(
  t: HiringTestbed,
  service: Service,
  worker: Worker,
  status: ApplicationStatus = 'Pending',
  extra: Partial<ServiceApplication> = {}
): Promise<ServiceApplication> {
  return t.applications.create({ service_id: service.id, worker_id: worker.id, status, insertion_date: NOW, ...extra });
}

export async function statusesOf(t: HiringTestbed, service: Service): Promise<[number, ApplicationStatus, boolean | undefined][]> {
  return (await t.applications.find({ service_id: service.id })).map((a) => [a.worker_id, a.status, a.auto_rejected]);
}
