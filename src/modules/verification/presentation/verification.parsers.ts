import { type Result, invalid, ok } from '#shared/domain/result';
import type { Body } from '#shared/infra/http/body';
import { text } from '#shared/utils/validation';
import { DOCUMENT_TYPES, REJECTION_REASON_MAX_LENGTH } from '../domain/verification';
import type { AdminVerification, VerificationDocumentType, VerificationReviewInput } from '../verification.contract';

// Formato das entradas da verificação (400).

const UPLOAD_HELP = 'Envie a foto do documento no corpo da requisição com Content-Type image/jpeg, image/png, image/webp ou image/avif.';

export function readDocumentUpload(body: unknown): Result<Uint8Array> {
  return Buffer.isBuffer(body) && body.length > 0 ? ok(new Uint8Array(body)) : invalid(UPLOAD_HELP);
}

export function parseDocumentType(value: unknown): Result<VerificationDocumentType> {
  const type = DOCUMENT_TYPES.find((t) => t === value);
  return type ? ok(type) : invalid(`Informe o documento em ?document_type=: ${DOCUMENT_TYPES.join(' ou ')}.`);
}

export function parseVerificationReview(body: Body): Result<VerificationReviewInput> {
  const status = body['status'];
  if (status !== 'approved' && status !== 'rejected') return invalid("A decisão (status) deve ser 'approved' ou 'rejected'.");
  const reason = body['reason'] === undefined || body['reason'] === null ? '' : text(body['reason']).trim();
  if (status === 'rejected' && !reason) return invalid('Diga o motivo da recusa (reason): a pessoa vê, para corrigir e enviar de novo.');
  if (reason.length > REJECTION_REASON_MAX_LENGTH) return invalid(`O motivo pode ter até ${REJECTION_REASON_MAX_LENGTH} caracteres.`);
  return ok({ status, reason: status === 'rejected' ? reason : null });
}

const STATUSES: readonly AdminVerification['status'][] = ['pending', 'approved', 'rejected'];

// ?status= da fila (opcional).
export function parseVerificationStatusQuery(value: unknown): Result<AdminVerification['status'] | undefined> {
  if (value === undefined) return ok(undefined);
  const status = STATUSES.find((s) => s === value);
  return status ? ok(status) : invalid(`Status inválido. Use um destes: ${STATUSES.join(', ')}.`);
}
