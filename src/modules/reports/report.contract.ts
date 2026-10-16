// Denúncias (issue #21): quem usa o app avisa a equipe sobre vaga falsa, condições ruins de trabalho ou
// mau comportamento. A equipe analisa na área do sistema e, se preciso, remove a conta.

// O que pode ser denunciado: o trabalhador denuncia uma vaga (service) ou o produtor (farmer);
// o produtor denuncia um trabalhador (worker).
export type ReportTargetType = 'service' | 'farmer' | 'worker';
export type ReportReason = 'fraude' | 'condicoes' | 'comportamento' | 'ofensivo' | 'outro';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

// POST /farmers/:id/reports e /workers/:id/reports
export interface ReportInput {
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  details?: string | null; // obrigatório quando o motivo é 'outro'
}

// A denúncia, como quem denunciou vê.
export interface Report {
  id: number;
  target_type: ReportTargetType;
  target_id: number;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  insertion_date: string; // ISO 8601
}

export interface ReportResponse {
  message: string;
  report: Report;
}

// Quem denunciou, para a equipe.
export interface ReportParty {
  role: 'farmer' | 'worker';
  profile_id: number;
  name: string; // '(perfil removido)' se não existe mais
  account_id: number | null;
}

// GET /admin/reports: a denúncia com os nomes, para a equipe decidir.
export interface AdminReport extends Report {
  reporter: ReportParty;
  target_name: string; // nome da vaga ou da pessoa ('(removido)' se não existe mais)
  target_account_id: number | null; // conta responsável (o produtor, no caso de uma vaga), para abrir na administração
  resolution_note: string | null;
  reviewed_at: string | null;
}

// PATCH /admin/reports/:id: procedente (resolved) ou descartada (dismissed).
export interface ReportReviewInput {
  status: 'resolved' | 'dismissed';
  note?: string | null;
}

export interface AdminReportResponse {
  message: string;
  report: AdminReport;
}
