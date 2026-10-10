import { randomUUID } from 'node:crypto';
import type { DocumentStore, StoredDocument } from '../../domain/documents';

const URL_PREFIX = '/api/documents/';

// Documentos guardados em memória (Map id → bytes). Tudo some quando o processo reinicia.
// Servidos por GET /api/documents/:id. Ver src/domain/documents.ts para a troca por um store real.
export class InMemoryDocumentStore implements DocumentStore {
  private readonly documents = new Map<string, StoredDocument>();

  save(document: StoredDocument): Promise<string> {
    const id = `${randomUUID()}.pdf`;
    this.documents.set(id, { bytes: document.bytes, contentType: document.contentType });
    return Promise.resolve(id);
  }

  get(id: string): Promise<StoredDocument | undefined> {
    return Promise.resolve(this.documents.get(id));
  }

  delete(id: string): Promise<void> {
    this.documents.delete(id);
    return Promise.resolve();
  }

  urlFor(id: string): string {
    return `${URL_PREFIX}${id}`;
  }

  idFromUrl(url: string): string | undefined {
    return url.startsWith(URL_PREFIX) ? url.slice(URL_PREFIX.length) : undefined;
  }
}
