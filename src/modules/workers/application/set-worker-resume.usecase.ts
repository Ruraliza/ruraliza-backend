import { type DocumentStore, PDF_CONTENT_TYPE, isPdf, releaseDocument } from '#shared/domain/documents';
import { type Result, invalid, notFound, ok } from '#shared/domain/result';
import type { Worker } from '../worker.contract';
import type { WorkerRepository } from '../domain/worker.repository';

export interface WorkerResumeDeps {
  workers: WorkerRepository;
  documents: DocumentStore;
}

// Currículo (um PDF; enviar de novo substitui e apaga o anterior). Guardado como chegou;
// o trabalhador guarda só a URL (`resume_url`).
export class SetWorkerResumeUseCase {
  constructor(private readonly deps: WorkerResumeDeps) {}

  async execute({ workerId, upload }: { workerId: number; upload: Uint8Array }): Promise<Result<Worker>> {
    const worker = await this.deps.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');
    if (!isPdf(upload)) return invalid('O arquivo enviado não é um PDF.');

    const id = await this.deps.documents.save({ bytes: upload, contentType: PDF_CONTENT_TYPE });
    await releaseDocument(this.deps.documents, worker.resume_url);
    worker.resume_url = this.deps.documents.urlFor(id);
    await this.deps.workers.update(worker);
    return ok(worker);
  }
}
