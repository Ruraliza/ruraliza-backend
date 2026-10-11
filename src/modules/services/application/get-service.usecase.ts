import { type FarmRepository, farmOf } from '#modules/farms';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { ServiceRepository } from '../domain/service.repository';
import type { ServiceWithFarm } from '../service.contract';

export interface GetServiceDeps {
  farms: FarmRepository;
  services: ServiceRepository;
}

export interface GetServiceInput {
  serviceId: number;
}

// Serviço com a fazenda completa (mesmo que removida), para o produtor.
export class GetServiceUseCase {
  constructor(private readonly deps: GetServiceDeps) {}

  async execute({ serviceId }: GetServiceInput): Promise<Result<ServiceWithFarm>> {
    const service = await this.deps.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    return ok({ ...service, farm: await farmOf(this.deps.farms, service) });
  }
}
