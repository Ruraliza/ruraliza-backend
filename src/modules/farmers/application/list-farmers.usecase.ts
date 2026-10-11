import { toPublicProfile } from '#shared/utils/profile';
import type { Farmer } from '../farmer.contract';
import type { FarmerRepository } from '../domain/farmer.repository';

// Lista dos produtores com CPF mascarado.
export class ListFarmersUseCase {
  constructor(private readonly deps: { farmers: FarmerRepository }) {}

  async execute(): Promise<Farmer[]> {
    return (await this.deps.farmers.find()).map(toPublicProfile);
  }
}
