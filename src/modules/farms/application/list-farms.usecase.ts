import { type Result, notFound, ok } from '#shared/domain/result';
import type { FarmerRepository } from '../../../domain/repositories';
import type { Farm } from '../farm.contract';
import type { FarmRepository } from '../domain/farm.repository';
import { isActiveFarm } from '../domain/farm.rules';

export interface ListFarmsDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
}

export interface ListFarmsInput {
  farmerId: number;
}

// Fazendas do produtor: só as ativas (as arquivadas ficam só no histórico dos serviços).
export class ListFarmsUseCase {
  constructor(private readonly deps: ListFarmsDeps) {}

  async execute({ farmerId }: ListFarmsInput): Promise<Result<Farm[]>> {
    const farmer = await this.deps.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const farms = await this.deps.farms.find({ farmer_id: farmer.id });
    return ok(farms.filter(isActiveFarm));
  }
}
