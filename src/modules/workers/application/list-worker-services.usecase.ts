import type { FarmRepository } from '#modules/farms';
import { type OpenService, type ServiceRepository, toOpenService } from '#modules/services';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { WorkerRepository } from '../domain/worker.repository';

export interface ListWorkerServicesDeps {
  workers: WorkerRepository;
  services: ServiceRepository;
  farms: FarmRepository;
}

// Serviços em que o trabalhador foi aceito (em andamento ou concluídos), com o ponto no mapa.
export class ListWorkerServicesUseCase {
  constructor(private readonly deps: ListWorkerServicesDeps) {}

  async execute({ workerId }: { workerId: number }): Promise<Result<OpenService[]>> {
    const worker = await this.deps.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const assigned = await this.deps.services.find({ worker_id: worker.id });
    return ok(await Promise.all(assigned.map((s) => toOpenService(this.deps.farms, s, worker.id))));
  }
}
