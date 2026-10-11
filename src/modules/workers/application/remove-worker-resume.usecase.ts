import { releaseDocument } from '#shared/domain/documents';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { Worker } from '../worker.contract';
import type { WorkerResumeDeps } from './set-worker-resume.usecase';

// Remove o currículo (resume_url = null) e o apaga do store.
export class RemoveWorkerResumeUseCase {
  constructor(private readonly deps: WorkerResumeDeps) {}

  async execute({ workerId }: { workerId: number }): Promise<Result<Worker>> {
    const worker = await this.deps.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    await releaseDocument(this.deps.documents, worker.resume_url);
    worker.resume_url = null;
    await this.deps.workers.update(worker);
    return ok(worker);
  }
}
