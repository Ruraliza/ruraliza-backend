import { createInMemoryAccountRepository } from '#modules/accounts';
import { createInMemoryFarmerRepository } from '#modules/farmers';
import { createInMemoryFarmRepository } from '#modules/farms';
import type { Farm } from '#modules/farms';
import { createInMemoryApplicationRepository } from '#modules/hiring';
import { createInMemoryPushSubscriptionRepository } from '#modules/notifications';
import { createInMemoryServiceRepository } from '#modules/services';
import type { Service } from '#modules/services';
import type { ChangeTopic } from '#shared/domain/changes';
import { InMemoryDocumentStore } from '#shared/infra/documents/in-memory-document-store';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import { fixedClock } from '#shared/testing/fixed-clock';
import { recordingChangeFeed } from '#shared/testing/recorders';
import type { NewWorker } from '../application/create-worker-profile.usecase';
import { createInMemoryWorkerRepository } from '../infra/in-memory-worker.repository';
import type { Worker } from '../worker.contract';
import type { WorkersModuleDeps } from '../workers.module';

// Dependências dos trabalhadores em memória, com hash de senha falso e avisos (SSE) gravados.

export const NOW = '2026-01-01T00:00:00.000Z';
export const PDF = new TextEncoder().encode('%PDF-1.4 currículo');
export const SIGNUP: NewWorker = {
  email: 'maria@exemplo.com', name: 'Maria', phone: '1', cpf: '11144477735', password: 'senha-forte',
  bio: 'Colheita de café', certificates: null, courses: null, experience: '5 anos'
};

export interface WorkersTestbed extends WorkersModuleDeps {
  images: InMemoryImageStore;
  documents: InMemoryDocumentStore;
  published: ChangeTopic[][];
}

export function workersTestbed(): WorkersTestbed {
  const changes = recordingChangeFeed();
  return {
    workers: createInMemoryWorkerRepository(),
    farmers: createInMemoryFarmerRepository(),
    farms: createInMemoryFarmRepository(),
    services: createInMemoryServiceRepository(),
    applications: createInMemoryApplicationRepository(),
    accounts: createInMemoryAccountRepository(),
    pushSubscriptions: createInMemoryPushSubscriptionRepository(),
    clock: fixedClock(NOW),
    images: new InMemoryImageStore(),
    documents: new InMemoryDocumentStore(),
    passwords: { hash: (p) => Promise.resolve(`hash(${p})`), verify: (p, h) => Promise.resolve(h === `hash(${p})`) },
    changes,
    published: changes.published
  };
}

export function givenWorker(t: WorkersTestbed, changes: Partial<Worker> = {}): Promise<Worker> {
  return t.workers.create({
    email: 'maria@exemplo.com', name: 'Maria', phone: '1', cpf: '11144477735', bio: null, certificates: null,
    courses: null, experience: null, photo_url: null, resume_url: null, insertion_date: NOW, ...changes
  });
}

export function givenFarm(t: WorkersTestbed): Promise<Farm> {
  return t.farms.create({
    farmer_id: 1, address: 'Estrada Velha, Km 3', city: 'Três Rios', state: 'RJ', latitude: -22.1, longitude: -43.2,
    photos: [], insertion_date: NOW
  });
}

export function givenService(t: WorkersTestbed, farm: Farm, changes: Partial<Service> = {}): Promise<Service> {
  return t.services.create({
    farmer_id: farm.farmer_id, farm_id: farm.id, payment_id: null, worker_id: null, name: 'Capina', description: null,
    category: 'Manutenção', duration: 4, price: 200, expires_at: null, status: 'Pending', insertion_date: NOW, ...changes
  });
}
