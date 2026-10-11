import { type ChangeFeed, type ChangeListener, workerApplications } from '#shared/domain/changes';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { WorkerRepository } from '../domain/worker.repository';

export interface WatchWorkerApplicationsDeps {
  workers: WorkerRepository;
  changes: ChangeFeed;
}

// Acompanha as candidaturas do trabalhador; devolve a função que para de acompanhar.
export class WatchWorkerApplicationsUseCase {
  constructor(private readonly deps: WatchWorkerApplicationsDeps) {}

  async execute({ workerId, listener }: { workerId: number; listener: ChangeListener }): Promise<Result<() => void>> {
    const worker = await this.deps.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');
    return ok(this.deps.changes.subscribe(workerApplications(worker.id), listener));
  }
}
