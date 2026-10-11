import { type Result, notFound, ok } from '#shared/domain/result';
import type { Farmer } from '../../../contracts';
import type { FarmerRepository } from '../../../domain/repositories';
import type { Farm } from '../farm.contract';
import type { FarmRepository } from '../domain/farm.repository';
import { findActiveFarm } from '../domain/farm.rules';

// Fazenda ativa que pertence ao produtor da rota (usada por editar e remover).
export async function findOwnFarm(
  repos: { farmers: FarmerRepository; farms: FarmRepository },
  farmerId: number,
  farmId: number
): Promise<Result<{ farmer: Farmer; farm: Farm }>> {
  const farmer = await repos.farmers.findById(farmerId);
  if (!farmer) return notFound('Produtor não encontrado.');

  const farm = await findActiveFarm(repos.farms, farmId);
  if (!farm || farm.farmer_id !== farmer.id) return notFound('Fazenda não encontrada.');

  return ok({ farmer, farm });
}
