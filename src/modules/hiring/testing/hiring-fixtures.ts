import { createInMemoryAccountRepository } from '#modules/accounts';
import { workerReputation } from '#modules/reviews';
import { type Service, createInMemoryServiceRepository } from '#modules/services';
import { createInMemoryWorkerRepository } from '#modules/workers';
import type { Worker } from '#modules/workers';
import type { ChangeTopic } from '#shared/domain/changes';
import { directTransaction } from '#shared/domain/transaction';
import { type SentPush, adjustableClock, recordingChangeFeed, recordingPush } from '#shared/testing/recorders';
import type { ApplicationStatus, Proposal, ProposalSide, ServiceApplication } from '../hiring.contract';
import { NO_HIRING_EVENTS, type NegotiationChat } from '../domain/hiring-events';
import { NO_VERIFIED_WORKERS } from '../domain/worker-verification';
import type { HiringModuleDeps } from '../hiring.module';
import { createInMemoryApplicationRepository } from '../infra/in-memory-application.repository';
import { createInMemoryPaymentRepository } from '../infra/in-memory-payment.repository';
import { createInMemoryProposalRepository } from '../infra/in-memory-proposal.repository';

// Dependências dos casos de uso de contratação, todas em memória, com relógio ajustável e
// avisos (SSE) e pushes gravados; e dados mínimos para montar cada cenário.

// 30/09/2026 ao meio-dia em Brasília (15h UTC): "hoje" é 2026-09-30.
export const NOW = '2026-09-30T15:00:00.000Z';
export const FARMER_ID = 1;

export interface HiringTestbed extends HiringModuleDeps {
  setNow(iso: string): void;
  published: ChangeTopic[][];
  pushes: SentPush[];
  // As conversas que o módulo de conversas mostraria (id -> conversa).
  openChats: Map<number, NegotiationChat>;
}

export function hiringTestbed(): HiringTestbed {
  const workers = createInMemoryWorkerRepository();
  const accounts = createInMemoryAccountRepository();
  const clock = adjustableClock(NOW);
  const changes = recordingChangeFeed();
  const push = recordingPush();
  const stores = {
    services: createInMemoryServiceRepository(), applications: createInMemoryApplicationRepository(),
    payments: createInMemoryPaymentRepository(), proposals: createInMemoryProposalRepository()
  };
  const openChats = new Map<number, NegotiationChat>();
  return {
    ...stores,
    transaction: directTransaction(stores),
    workers,
    accounts,
    clock,
    changes,
    push,
    events: NO_HIRING_EVENTS,
    chats: { find: (id) => Promise.resolve(openChats.get(id) ?? null) },
    openChats,
    // Sem avaliações: todo candidato sai com a reputação vazia.
    reputation: { forWorkers: (ids) => Promise.resolve(new Map(ids.map((id) => [id, workerReputation([])]))) },
    verification: NO_VERIFIED_WORKERS,
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
    farmer_id: FARMER_ID, farm_id: 1, payment_id: null, proposal_id: null, agreement: null, completed_at: null, price: 200, price_unit: 'fixed', worker_id: null,
    name: 'Capina', description: null, category: 'Capina', duration: 4,
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

// A conversa (aberta) de uma candidatura: o id é o da candidatura, para simplificar.
export function givenChat(t: HiringTestbed, application: ServiceApplication, open = true): NegotiationChat {
  const chat = { id: application.id, service_id: application.service_id, worker_id: application.worker_id, open };
  t.openChats.set(chat.id, chat);
  return chat;
}

export function givenProposal(t: HiringTestbed, application: ServiceApplication, proposedBy: ProposalSide, status: Proposal['status'] = 'Pending'): Promise<Proposal> {
  return t.proposals.create({
    application_id: application.id, service_id: application.service_id, farmer_id: FARMER_ID, worker_id: application.worker_id,
    amount: 150, unit: 'day', notes: null, proposed_by: proposedBy, status,
    insertion_date: NOW, answered_at: status === 'Accepted' || status === 'Declined' ? NOW : null
  });
}
