import type { FarmerRepository } from '#modules/farmers';
import { type Result, ok } from '#shared/domain/result';
import type { FarmRepository } from '../domain/farm.repository';
import type { Farm, FarmUpdate } from '../farm.contract';
import { findOwnFarm } from './find-own-farm';

export interface UpdateFarmDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
}

export interface UpdateFarmInput {
  farmerId: number;
  farmId: number;
  changes: FarmUpdate;
}

// Edição parcial: só os campos enviados mudam (latitude e longitude chegam juntas, ver farm.parsers).
export class UpdateFarmUseCase {
  constructor(private readonly deps: UpdateFarmDeps) {}

  async execute({ farmerId, farmId, changes }: UpdateFarmInput): Promise<Result<Farm>> {
    const found = await findOwnFarm(this.deps, farmerId, farmId);
    if (!found.ok) return found;

    const { farm } = found.value;
    if (changes.address !== undefined) farm.address = changes.address;
    if (changes.city !== undefined) farm.city = changes.city;
    if (changes.state !== undefined) farm.state = changes.state;
    if (changes.latitude !== undefined) farm.latitude = changes.latitude;
    if (changes.longitude !== undefined) farm.longitude = changes.longitude;
    await this.deps.farms.update(farm);

    return ok(farm);
  }
}
