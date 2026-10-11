import { toPublicProfile } from '#shared/utils/profile';
import type { Worker } from '../worker.contract';
import type { WorkerRepository } from '../domain/worker.repository';

// Lista dos trabalhadores com CPF mascarado.
export class ListWorkersUseCase {
  constructor(private readonly deps: { workers: WorkerRepository }) {}

  async execute(): Promise<Worker[]> {
    return (await this.deps.workers.find()).map(toPublicProfile);
  }
}
