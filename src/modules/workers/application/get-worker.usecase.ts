import { type Result, notFound, ok } from '#shared/domain/result';
import type { Worker } from '../worker.contract';
import type { WorkerRepository } from '../domain/worker.repository';

// Perfil completo (CPF sem máscara), para o próprio trabalhador.
export class GetWorkerUseCase {
  constructor(private readonly deps: { workers: WorkerRepository }) {}

  async execute({ workerId }: { workerId: number }): Promise<Result<Worker>> {
    const worker = await this.deps.workers.findById(workerId);
    return worker ? ok(worker) : notFound('Trabalhador não encontrado.');
  }
}
