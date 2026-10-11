import type { ServiceRepository } from '#modules/services';
import { type ChangeFeed, type ChangeListener, serviceApplications } from '#shared/domain/changes';
import { type Result, notFound, ok } from '#shared/domain/result';

export interface WatchServiceApplicationsDeps {
  services: ServiceRepository;
  changes: ChangeFeed;
}

export interface WatchServiceApplicationsInput {
  serviceId: number;
  listener: ChangeListener;
}

// Acompanha as candidaturas do serviço (tela do produtor); devolve a função que para de acompanhar.
export class WatchServiceApplicationsUseCase {
  constructor(private readonly deps: WatchServiceApplicationsDeps) {}

  async execute({ serviceId, listener }: WatchServiceApplicationsInput): Promise<Result<() => void>> {
    const service = await this.deps.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    return ok(this.deps.changes.subscribe(serviceApplications(service.id), listener));
  }
}
