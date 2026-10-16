import type { UserRole } from '#modules/accounts';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import { DOCUMENT_MAX_SIDE, type VerificationRecord, isVerified, toVerification } from '../domain/verification';
import type { Verification, VerificationDocumentType } from '../verification.contract';
import { type VerificationDeps, dropDocument, findVerification, identityOf } from './verification-deps';

export interface SubmitVerificationCommand {
  role: UserRole;
  profileId: number;
  documentType: VerificationDocumentType;
  upload: Uint8Array;
}

// Envia (ou reenvia) a foto do documento: o pedido volta para a fila da equipe e a foto anterior,
// se houver, é apagada. Com o selo valendo, não há o que enviar (409); se o nome do perfil mudou
// depois da aprovação, o selo some e a pessoa pode verificar de novo.
export class SubmitVerificationUseCase {
  constructor(private readonly deps: VerificationDeps) {}

  async execute({ role, profileId, documentType, upload }: SubmitVerificationCommand): Promise<Result<Verification>> {
    const { verifications, idDocuments, clock } = this.deps;
    const identity = await identityOf(this.deps, role, profileId);
    if (!identity) return notFound('Perfil não encontrado.');
    const current = await findVerification(this.deps, role, profileId);
    if (isVerified(current, identity.name)) return conflict('Seu perfil já está verificado.');

    const image = await idDocuments.processor.normalize(upload, { maxSide: DOCUMENT_MAX_SIDE });
    if (!image.ok) return image;
    const documentId = await idDocuments.store.save(image.value);

    const pending: Omit<VerificationRecord, 'id'> = {
      role, profile_id: profileId, document_type: documentType, document_id: documentId, status: 'pending',
      submitted_at: clock.now(), reviewed_at: null, rejection_reason: null, verified_name: null
    };
    let record: VerificationRecord;
    if (current) {
      await dropDocument(this.deps, current);
      record = { ...pending, id: current.id };
      await verifications.update(record);
    } else {
      record = await verifications.create(pending);
    }
    return ok(toVerification(record, identity.name));
  }
}
