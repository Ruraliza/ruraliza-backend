import type { FarmRepository } from '#modules/farms';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { FarmReputationReader } from '../domain/farm-reputation';
import type { FarmerVerificationReader } from '../domain/farmer-verification';
import type { ServiceRepository } from '../domain/service.repository';
import { toOpenService } from '../domain/service.rules';
import type { OpenService } from '../service.contract';

export interface GetOpenServiceDeps {
  farms: FarmRepository;
  services: ServiceRepository;
  reputation: FarmReputationReader;
  verification: FarmerVerificationReader;
}

export interface GetOpenServiceInput {
  serviceId: number;
  viewerWorkerId?: number | undefined;
}

// Detalhe da vaga (em qualquer status) com cidade/UF da fazenda; o ponto no mapa só vai para
// o trabalhador aceito (`viewerWorkerId`). Traz a reputação da fazenda e se o produtor é verificado.
export class GetOpenServiceUseCase {
  constructor(private readonly deps: GetOpenServiceDeps) {}

  async execute({ serviceId, viewerWorkerId }: GetOpenServiceInput): Promise<Result<OpenService>> {
    const service = await this.deps.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    const job = await toOpenService(this.deps.farms, service, viewerWorkerId);
    const reputation = (await this.deps.reputation.forFarms([service.farm_id])).get(service.farm_id);
    const verified = (await this.deps.verification.verifiedFarmers([service.farmer_id])).has(service.farmer_id);
    return ok({ ...job, farm: { ...job.farm, ...(reputation ? { reputation } : {}), ...(verified ? { farmer_verified: true as const } : {}) } });
  }
}
