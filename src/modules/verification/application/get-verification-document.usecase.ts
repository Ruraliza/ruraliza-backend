import type { StoredImage } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { VerificationDeps } from './verification-deps';

// A foto do documento, só para a equipe e só enquanto o pedido está em análise.
export class GetVerificationDocumentUseCase {
  constructor(private readonly deps: VerificationDeps) {}

  async execute({ id }: { id: number }): Promise<Result<StoredImage>> {
    const record = await this.deps.verifications.findById(id);
    if (!record) return notFound('Pedido de verificação não encontrado.');
    const image = record.document_id === null ? undefined : await this.deps.idDocuments.store.get(record.document_id);
    return image ? ok(image) : notFound('A foto do documento já foi apagada (o pedido foi decidido).');
  }
}
