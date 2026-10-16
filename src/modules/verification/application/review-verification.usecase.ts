import { findAccountOf, otherRole, profileKey } from '#modules/accounts';
import { type PushMessage, profileUrl } from '#modules/notifications';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { VerificationRecord } from '../domain/verification';
import type { AdminVerification, VerificationReviewInput } from '../verification.contract';
import { type ProfileIdentity, type VerificationDeps, dropDocument, findVerification, identityOf, toAdminVerification } from './verification-deps';

function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function decisionMessage(record: VerificationRecord): PushMessage {
  const url = profileUrl(record.role);
  return record.status === 'approved'
    ? { title: 'Seu perfil foi verificado', body: 'O selo de verificado já aparece para quem vê seu perfil. A foto do documento foi apagada.', url }
    : {
        title: 'Não conseguimos verificar seu perfil',
        body: `${sentence(record.rejection_reason ?? 'O documento não pôde ser conferido')} Você pode enviar o documento de novo pelo seu perfil.`,
        url
      };
}

// Decisão da equipe sobre um pedido em análise. Nos dois casos a foto do documento é apagada na hora.
// Aprovado: guarda o nome conferido (o selo vale enquanto o perfil tiver esse nome) e, se a conta tem o
// outro perfil com o mesmo CPF, ele ganha o selo junto. Recusado: o motivo vai para a pessoa.
export class ReviewVerificationUseCase {
  constructor(private readonly deps: VerificationDeps) {}

  async execute({ id, input }: { id: number; input: VerificationReviewInput }): Promise<Result<AdminVerification>> {
    const { verifications, clock, push } = this.deps;
    const record = await verifications.findById(id);
    if (!record) return notFound('Pedido de verificação não encontrado.');
    if (record.status !== 'pending') return conflict('Este pedido já foi decidido.');
    const identity = await identityOf(this.deps, record.role, record.profile_id);
    if (!identity) return notFound('O perfil deste pedido não existe mais.');

    await dropDocument(this.deps, record);
    const reviewed = { ...record, document_id: null, reviewed_at: clock.now() };
    const decided: VerificationRecord = input.status === 'approved'
      ? { ...reviewed, status: 'approved', rejection_reason: null, verified_name: identity.name }
      : { ...reviewed, status: 'rejected', rejection_reason: input.reason ?? null, verified_name: null };
    await verifications.update(decided);
    if (decided.status === 'approved') await this.approveOtherProfile(decided, identity);

    push.notify(record.role, record.profile_id, decisionMessage(decided));
    return ok(await toAdminVerification(this.deps, decided));
  }

  private async approveOtherProfile(record: VerificationRecord, identity: ProfileIdentity): Promise<void> {
    const role = otherRole(record.role);
    const account = await findAccountOf(this.deps.accounts, record.role, record.profile_id);
    const profileId = account?.[profileKey(role)] ?? null;
    if (profileId === null) return;
    const other = await identityOf(this.deps, role, profileId);
    if (!other || other.cpf !== identity.cpf) return;

    const approved: Omit<VerificationRecord, 'id'> = {
      role, profile_id: profileId, document_type: record.document_type, document_id: null, status: 'approved',
      submitted_at: record.submitted_at, reviewed_at: record.reviewed_at, rejection_reason: null, verified_name: other.name
    };
    const existing = await findVerification(this.deps, role, profileId);
    if (existing) {
      await dropDocument(this.deps, existing);
      await this.deps.verifications.update({ ...approved, id: existing.id });
    } else {
      await this.deps.verifications.create(approved);
    }
  }
}
