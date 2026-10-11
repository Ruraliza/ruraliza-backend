import { requireFound } from '#shared/domain/result';
import type { Service } from '../../../contracts';
import type { Farm } from '../farm.contract';
import type { FarmRepository } from './farm.repository';

// Fazenda removida pelo produtor continua guardada (deleted_at) para o histórico dos serviços,
// mas some das listas e não pode mais ser editada nem receber serviços.
export function isActiveFarm(farm: Farm): boolean {
  return farm.deleted_at === undefined;
}

export async function findActiveFarm(farms: FarmRepository, id: number): Promise<Farm | undefined> {
  const farm = await farms.findById(id);
  return farm && isActiveFarm(farm) ? farm : undefined;
}

// A fazenda de um serviço (mesmo arquivada) sempre existe enquanto o serviço existir.
export async function farmOf(farms: FarmRepository, service: Service): Promise<Farm> {
  return requireFound(await farms.findById(service.farm_id), `fazenda do serviço ${service.id}`);
}
