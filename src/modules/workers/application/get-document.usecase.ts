import type { DocumentStore, StoredDocument } from '#shared/domain/documents';
import { type Result, notFound, ok } from '#shared/domain/result';

// Bytes para GET /api/documents/:id.
export class GetDocumentUseCase {
  constructor(private readonly deps: { documents: DocumentStore }) {}

  async execute({ documentId }: { documentId: string }): Promise<Result<StoredDocument>> {
    const document = await this.deps.documents.get(documentId);
    return document ? ok(document) : notFound('Documento não encontrado.');
  }
}
