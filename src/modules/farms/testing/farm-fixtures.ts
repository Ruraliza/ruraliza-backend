import { createInMemoryFarmerRepository } from '#modules/farmers';
import type { FarmerRepository } from '#modules/farmers';
import type { Farmer } from '#modules/farmers';
import { createInMemoryServiceRepository } from '#modules/services';
import type { ServiceRepository } from '#modules/services';
import type { Service, ServiceStatus } from '#modules/services';
import type { Clock } from '#shared/domain/clock';
import { fixedClock } from '#shared/testing/fixed-clock';
import type { FarmRepository } from '../domain/farm.repository';
import type { Farm } from '../farm.contract';
import { createInMemoryFarmRepository } from '../infra/in-memory-farm.repository';

// Dependências dos casos de uso de fazenda, todas em memória, e dados mínimos para montar cada cenário.

export const NOW = '2026-01-01T00:00:00.000Z';

export interface FarmsTestbed {
  farmers: FarmerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  clock: Clock;
}

export function farmsTestbed(): FarmsTestbed {
  const farmers = createInMemoryFarmerRepository();
  const services = createInMemoryServiceRepository();
  return { farmers, farms: createInMemoryFarmRepository(), services, clock: fixedClock(NOW) };
}

export function givenFarmer(t: FarmsTestbed, email = 'ana@exemplo.com', cpf = '52998224725'): Promise<Farmer> {
  return t.farmers.create({ email, name: email, phone: '1', cpf, farms: [], photo_url: null, insertion_date: NOW });
}

// Fazenda ativa já ligada ao produtor (em `farmer.farms`), como o cadastro deixa.
export async function givenFarm(t: FarmsTestbed, farmer: Farmer): Promise<Farm> {
  const farm = await t.farms.create({
    farmer_id: farmer.id, address: 'Sítio', city: 'Três Rios', state: 'RJ',
    latitude: -22.1165, longitude: -43.2092, photos: [], insertion_date: NOW
  });
  await t.farmers.update({ ...farmer, farms: [...farmer.farms, farm.id] });
  return farm;
}

export function givenService(t: FarmsTestbed, farm: Farm, status: ServiceStatus): Promise<Service> {
  return t.services.create({
    farmer_id: farm.farmer_id, farm_id: farm.id, payment_id: null, worker_id: null,
    name: 'Capina', description: null, category: 'Manutenção', duration: 4, price: 200,
    expires_at: null, status, insertion_date: NOW
  });
}
