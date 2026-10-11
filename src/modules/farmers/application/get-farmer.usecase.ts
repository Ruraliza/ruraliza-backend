import { type Result, notFound, ok } from '#shared/domain/result';
import type { Farmer } from '../farmer.contract';
import type { FarmerRepository } from '../domain/farmer.repository';

// Perfil completo (CPF sem máscara), para o próprio produtor.
export class GetFarmerUseCase {
  constructor(private readonly deps: { farmers: FarmerRepository }) {}

  async execute({ farmerId }: { farmerId: number }): Promise<Result<Farmer>> {
    const farmer = await this.deps.farmers.findById(farmerId);
    return farmer ? ok(farmer) : notFound('Produtor não encontrado.');
  }
}
