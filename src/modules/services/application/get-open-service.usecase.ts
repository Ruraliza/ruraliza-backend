import type { FarmRepository } from '#modules/farms';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { ServiceRepository } from '../domain/service.repository';
import { toOpenService } from '../domain/service.rules';
import type { OpenService } from '../service.contract';

export interface GetOpenServiceDeps {
  farms: FarmRepository;
  services: ServiceRepository;
}

export interface GetOpenServiceInput {
  serviceId: number;
  viewerWorkerId?: number | undefined;
}

// Detalhe da vaga (em qualquer status) com cidade/UF da fazenda; o ponto no mapa só vai para
// o trabalhador aceito (`viewerWorkerId`).
export class GetOpenServiceUseCase {
  constructor(private readonly deps: GetOpenServiceDeps) {}

  async execute({ serviceId, viewerWorkerId }: GetOpenServiceInput): Promise<Result<OpenService>> {
    const service = await this.deps.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    return ok(await toOpenService(this.deps.farms, service, viewerWorkerId));
  }
}
