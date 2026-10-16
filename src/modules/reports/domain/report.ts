import type { UserRole } from '#modules/accounts';
import type { Repository } from '#shared/domain/repository';
import type { Report, ReportReason, ReportStatus, ReportTargetType } from '../report.contract';

// Denúncia como fica guardada: com quem denunciou e a decisão da equipe.
// TODO(db): tabela `reports (id, reporter_role, reporter_id, target_type, target_id, reason, details, status,
// resolution_note, insertion_date, reviewed_at)` com índice (status, id).
export interface ReportRecord extends Report {
  reporter_role: UserRole;
  reporter_id: number;
  resolution_note: string | null; // anotação interna da equipe; quem denunciou não vê
  reviewed_at: string | null;
}

export type ReportRepository = Repository<ReportRecord, 'status' | 'reporter_role' | 'reporter_id' | 'target_type' | 'target_id'>;

export const REPORT_TARGET_TYPES: readonly ReportTargetType[] = ['service', 'farmer', 'worker'];
export const REPORT_REASONS: readonly ReportReason[] = ['fraude', 'condicoes', 'comportamento', 'ofensivo', 'outro'];
export const REPORT_STATUSES: readonly ReportStatus[] = ['open', 'resolved', 'dismissed'];
export const REPORT_DETAILS_MAX_LENGTH = 500;
export const REPORT_NOTE_MAX_LENGTH = 500;

// Quem pode denunciar o quê: o trabalhador, a vaga ou o produtor; o produtor, o trabalhador.
export const REPORTABLE: Readonly<Record<UserRole, readonly ReportTargetType[]>> = {
  worker: ['service', 'farmer'],
  farmer: ['worker']
};

export const REPORTABLE_MESSAGE: Readonly<Record<UserRole, string>> = {
  worker: "O trabalhador denuncia uma vaga ('service') ou um produtor ('farmer').",
  farmer: "O produtor denuncia um trabalhador ('worker')."
};

export function toReport({ id, target_type, target_id, reason, details, status, insertion_date }: ReportRecord): Report {
  return { id, target_type, target_id, reason, details, status, insertion_date };
}
