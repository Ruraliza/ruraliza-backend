import { type Farmer, createInMemoryFarmerRepository } from '#modules/farmers';
import { type Service, createInMemoryServiceRepository } from '#modules/services';
import { type Worker, createInMemoryWorkerRepository } from '#modules/workers';
import type { ChangeTopic } from '#shared/domain/changes';
import { type SentPush, adjustableClock, recordingChangeFeed, recordingPush } from '#shared/testing/recorders';
import type { ChatModuleDeps } from '../chat.module';
import type { ChatViewer } from '../domain/chat.rules';
import { createInMemoryChatMessageRepository, createInMemoryChatRepository } from '../infra/in-memory-chat.repositories';

// Dependências das conversas em memória, com relógio ajustável e avisos/pushes gravados; e um
// serviço em andamento entre João (produtor) e Maria (trabalhadora).

export const NOW = '2026-09-30T15:00:00.000Z';

export interface ChatTestbed extends ChatModuleDeps {
  setNow(iso: string): void;
  published: ChangeTopic[][];
  pushes: SentPush[];
}

export function chatTestbed(): ChatTestbed {
  const clock = adjustableClock(NOW);
  const changes = recordingChangeFeed();
  const push = recordingPush();
  return {
    chats: createInMemoryChatRepository(),
    chatMessages: createInMemoryChatMessageRepository(),
    services: createInMemoryServiceRepository(),
    farmers: createInMemoryFarmerRepository(),
    workers: createInMemoryWorkerRepository(),
    clock,
    changes,
    push,
    setNow: clock.set,
    published: changes.published,
    pushes: push.sent
  };
}

export interface Hiring {
  farmer: Farmer;
  worker: Worker;
  service: Service;
  asFarmer: ChatViewer;
  asWorker: ChatViewer;
}

export async function givenHiring(t: ChatTestbed): Promise<Hiring> {
  const farmer = await t.farmers.create({
    email: 'joao@exemplo.com', name: 'João Produtor', farms: [], phone: '24999990000', cpf: '52998224725', photo_url: null, insertion_date: NOW
  });
  const worker = await t.workers.create({
    email: 'maria@exemplo.com', name: 'Maria Trabalhadora', phone: '24988887766', cpf: '11144477735',
    bio: null, certificates: null, courses: null, experience: null, photo_url: null, resume_url: null, insertion_date: NOW
  });
  const service = await t.services.create({
    farmer_id: farmer.id, farm_id: 1, payment_id: null, worker_id: worker.id, name: 'Colheita de café', description: null,
    category: 'Colheita', duration: 8, price: 400, expires_at: null, status: 'In Progress', insertion_date: NOW
  });
  return {
    farmer,
    worker,
    service,
    asFarmer: { farmerId: farmer.id, workerId: null },
    asWorker: { farmerId: null, workerId: worker.id }
  };
}
