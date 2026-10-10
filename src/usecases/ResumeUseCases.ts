import type { Worker } from '../contracts';
import { type DocumentStore, PDF_CONTENT_TYPE, type StoredDocument, isPdf } from '../domain/documents';
import type { WorkerRepository } from '../domain/repositories';
import { type Result, invalid, notFound, ok } from '../domain/result';

// Currículo do trabalhador (um PDF; enviar de novo substitui). O PDF é guardado como chegou
// no DocumentStore; o trabalhador guarda só a URL (`resume_url`).
export class ResumeUseCases {
  constructor(
    private readonly repos: { workers: WorkerRepository },
    private readonly documents: DocumentStore
  ) {}

  // Bytes para GET /api/documents/:id.
  async getDocument(id: string): Promise<Result<StoredDocument>> {
    const document = await this.documents.get(id);
    return document ? ok(document) : notFound('Documento não encontrado.');
  }

  async setWorkerResume(workerId: number, upload: Uint8Array): Promise<Result<Worker>> {
    const worker = await this.repos.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');
    if (!isPdf(upload)) return invalid('O arquivo enviado não é um PDF.');

    const id = await this.documents.save({ bytes: upload, contentType: PDF_CONTENT_TYPE });
    await releaseDocument(this.documents, worker.resume_url);
    worker.resume_url = this.documents.urlFor(id);
    await this.repos.workers.update(worker);
    return ok(worker);
  }

  async removeWorkerResume(workerId: number): Promise<Result<Worker>> {
    const worker = await this.repos.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    await releaseDocument(this.documents, worker.resume_url);
    worker.resume_url = null;
    await this.repos.workers.update(worker);
    return ok(worker);
  }
}

// Apaga do store o documento de uma URL gerada por ele (sem erro se não houver).
export async function releaseDocument(store: DocumentStore, url: string | null): Promise<void> {
  if (url === null) return;
  const id = store.idFromUrl(url);
  if (id !== undefined) await store.delete(id);
}
