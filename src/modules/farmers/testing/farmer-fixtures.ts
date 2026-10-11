import { createInMemoryAccountRepository } from '#modules/accounts';
import { createInMemoryFarmRepository } from '#modules/farms';
import type { Farm } from '#modules/farms';
import { createInMemoryApplicationRepository } from '#modules/hiring';
import { createInMemoryPushSubscriptionRepository } from '#modules/notifications';
import { createInMemoryServiceRepository } from '#modules/services';
import { createInMemoryWorkerRepository } from '#modules/workers';
import type { ChangeTopic } from '#shared/domain/changes';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import { fixedClock } from '#shared/testing/fixed-clock';
import { recordingChangeFeed } from '#shared/testing/recorders';
import type { Farmer, FarmerInput } from '../farmer.contract';
import type { FarmersModuleDeps } from '../farmers.module';
import { createInMemoryFarmerRepository } from '../infra/in-memory-farmer.repository';

// Dependências dos produtores em memória, com hash de senha falso e avisos (SSE) gravados.

export const NOW = '2026-01-01T00:00:00.000Z';
export const SIGNUP: FarmerInput = { email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', password: 'senha-forte' };

export interface FarmersTestbed extends FarmersModuleDeps {
  images: InMemoryImageStore;
  published: ChangeTopic[][];
}

export function farmersTestbed(): FarmersTestbed {
  const repos = { farmers: createInMemoryFarmerRepository(), workers: createInMemoryWorkerRepository(), farms: createInMemoryFarmRepository(), services: createInMemoryServiceRepository(), applications: createInMemoryApplicationRepository(), accounts: createInMemoryAccountRepository(), pushSubscriptions: createInMemoryPushSubscriptionRepository() };
  const changes = recordingChangeFeed();
  return {
    ...repos,
    clock: fixedClock(NOW),
    images: new InMemoryImageStore(),
    passwords: { hash: (p) => Promise.resolve(`hash(${p})`), verify: (p, h) => Promise.resolve(h === `hash(${p})`) },
    changes,
    published: changes.published
  };
}

export function givenFarmer(t: FarmersTestbed, changes: Partial<Farmer> = {}): Promise<Farmer> {
  return t.farmers.create({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', farms: [], photo_url: null, insertion_date: NOW, ...changes });
}

export function givenFarm(t: FarmersTestbed, farmer: Farmer, changes: Partial<Farm> = {}): Promise<Farm> {
  return t.farms.create({
    farmer_id: farmer.id, address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: null, longitude: null,
    photos: [], insertion_date: NOW, ...changes
  });
}
