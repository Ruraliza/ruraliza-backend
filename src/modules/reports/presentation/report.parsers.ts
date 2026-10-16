import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, missingMessage } from '#shared/infra/http/body';
import { missingFields, text } from '#shared/utils/validation';
import {
  REPORT_DETAILS_MAX_LENGTH,
  REPORT_NOTE_MAX_LENGTH,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES
} from '../domain/report';
import type { ReportInput, ReportReviewInput, ReportStatus } from '../report.contract';

// Formato dos corpos das denúncias (400). Os detalhes não passam pelo filtro de palavrões: quem
// denuncia uma ofensa precisa poder contar o que ouviu, e só a equipe lê.

function optionalTrimmed(value: unknown): string {
  return value === undefined || value === null ? '' : text(value).trim();
}

export function parseReportInput(body: Body): Result<ReportInput> {
  const missing = missingFields(body, ['target_type', 'target_id', 'reason']);
  if (missing.length > 0) return invalid(missingMessage(missing));
  const targetType = REPORT_TARGET_TYPES.find((t) => t === body['target_type']);
  if (!targetType) return invalid(`O alvo (target_type) deve ser um destes: ${REPORT_TARGET_TYPES.join(', ')}.`);
  const targetId = body['target_id'];
  if (typeof targetId !== 'number' || !Number.isInteger(targetId) || targetId < 1) return invalid('O ID do alvo (target_id) deve ser um número inteiro positivo.');
  const reason = REPORT_REASONS.find((r) => r === body['reason']);
  if (!reason) return invalid(`O motivo (reason) deve ser um destes: ${REPORT_REASONS.join(', ')}.`);
  const details = optionalTrimmed(body['details']);
  if (reason === 'outro' && !details) return invalid('Conte o que aconteceu (details): é obrigatório quando o motivo é "outro".');
  if (details.length > REPORT_DETAILS_MAX_LENGTH) return invalid(`O relato pode ter até ${REPORT_DETAILS_MAX_LENGTH} caracteres.`);
  return ok({ target_type: targetType, target_id: targetId, reason, details: details || null });
}

export function parseReportReview(body: Body): Result<ReportReviewInput> {
  const status = body['status'];
  if (status !== 'resolved' && status !== 'dismissed') return invalid("A decisão (status) deve ser 'resolved' (procedente) ou 'dismissed' (descartada).");
  const note = optionalTrimmed(body['note']);
  if (note.length > REPORT_NOTE_MAX_LENGTH) return invalid(`A anotação pode ter até ${REPORT_NOTE_MAX_LENGTH} caracteres.`);
  return ok({ status, note: note || null });
}

// ?status= da fila (opcional).
export function parseReportStatusQuery(value: unknown): Result<ReportStatus | undefined> {
  if (value === undefined) return ok(undefined);
  const status = REPORT_STATUSES.find((s) => s === value);
  return status ? ok(status) : invalid(`Status inválido. Use um destes: ${REPORT_STATUSES.join(', ')}.`);
}
