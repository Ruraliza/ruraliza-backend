import { createInMemoryFarmerRepository } from '#modules/farmers';
import type { Farmer } from '#modules/farmers';
import { type Farm, createInMemoryFarmRepository } from '#modules/farms';
import { createInMemoryApplicationRepository } from '#modules/hiring';
import type { ApplicationStatus, ServiceApplication } from '#modules/hiring';
import type { ChangeTopic } from '#shared/domain/changes';
import { type SentPush, adjustableClock, recordingChangeFeed, recordingPush } from '#shared/testing/recorders';
import { createInMemoryServiceRepository } from '../infra/in-memory-service.repository';
import { NO_VERIFIED_FARMERS } from '../domain/farmer-verification';
import type { Service } from '../service.contract';
import type { ServicesModuleDeps } from '../services.module';

// Dependências dos casos de uso de serviço, todas em memória, com relógio ajustável e
// avisos (SSE) e pushes gravados para conferir; e dados mínimos para montar cada cenário.

// 30/09/2026 ao meio-dia em Brasília (15h UTC): "hoje" é 2026-09-30.
export const NOW = '2026-09-30T15:00:00.000Z';

export interface ServicesTestbed extends ServicesModuleDeps {
  setNow(iso: string): void;
  published: ChangeTopic[][];
  pushes: SentPush[];
}

export function servicesTestbed(): ServicesTestbed {
  const farmers = createInMemoryFarmerRepository();
  const applications = createInMemoryApplicationRepository();
  const clock = adjustableClock(NOW);
  const changes = recordingChangeFeed();
  const push = recordingPush();
  return {
    farmers,
    farms: createInMemoryFarmRepository(),
    services: createInMemoryServiceRepository(),
    applications,
    clock,
    changes,
    push,
    reputation: { forFarms: () => Promise.resolve(new Map()) }, // sem avaliações: as vagas saem sem `farm.reputation`
    verification: NO_VERIFIED_FARMERS,
    setNow: clock.set,
    published: changes.published,
    pushes: push.sent
  };
}

export function givenFarmer(t: ServicesTestbed, email = 'ana@exemplo.com', cpf = '52998224725'): Promise<Farmer> {
  return t.farmers.create({ email, name: email, phone: '1', cpf, farms: [], photo_url: null, insertion_date: NOW });
}

export function givenFarm(t: ServicesTestbed, farmer: Farmer, changes: Partial<Farm> = {}): Promise<Farm> {
  return t.farms.create({
    farmer_id: farmer.id, address: 'Estrada Velha, Km 3', city: 'Três Rios', state: 'RJ',
    latitude: -22.1165, longitude: -43.2092, photos: [], insertion_date: NOW, ...changes
  });
}

export function givenService(t: ServicesTestbed, farm: Farm, changes: Partial<Service> = {}): Promise<Service> {
  return t.services.create({
    farmer_id: farm.farmer_id, farm_id: farm.id, payment_id: null, worker_id: null,
    name: 'Capina', description: null, category: 'Manutenção', duration: 4, price: 200,
    expires_at: null, status: 'Pending', insertion_date: NOW, ...changes
  });
}

export function givenApplication(
  t: ServicesTestbed,
  service: Service,
  workerId: number,
  status: ApplicationStatus = 'Pending'
): Promise<ServiceApplication> {
  return t.applications.create({ service_id: service.id, worker_id: workerId, status, insertion_date: NOW });
}
