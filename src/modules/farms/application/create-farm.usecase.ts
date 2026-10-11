import type { FarmerRepository } from '#modules/farmers';
import type { Clock } from '#shared/domain/clock';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { FarmRepository } from '../domain/farm.repository';
import type { Farm, FarmInput } from '../farm.contract';

export interface CreateFarmDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  clock: Clock;
}

export interface CreateFarmInput {
  farmerId: number;
  input: FarmInput;
}

// Cadastra a fazenda (sem fotos) e a acrescenta a `farmer.farms`.
export class CreateFarmUseCase {
  constructor(private readonly deps: CreateFarmDeps) {}

  async execute({ farmerId, input }: CreateFarmInput): Promise<Result<Farm>> {
    const farmer = await this.deps.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const farm = await this.deps.farms.create({ farmer_id: farmer.id, ...input, photos: [], insertion_date: this.deps.clock.now() });
    farmer.farms.push(farm.id);
    await this.deps.farmers.update(farmer);

    return ok(farm);
  }
}
