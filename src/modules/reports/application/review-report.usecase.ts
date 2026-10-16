import { type PushMessage, helpUrl } from '#modules/notifications';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { ReportRecord } from '../domain/report';
import type { AdminReport, ReportReviewInput } from '../report.contract';
import { REMOVED_TARGET, type ReportDeps, toAdminReport } from './report-deps';

// Quem denunciou fica sabendo do resultado (sem a anotação interna da equipe).
function reviewedMessage(report: AdminReport): PushMessage {
  const target = report.target_name === REMOVED_TARGET ? null : report.target_type === 'service' ? `a vaga ${report.target_name}` : `o perfil de ${report.target_name}`;
  const about = target ? ` sobre ${target}` : '';
  return {
    title: 'Sua denúncia foi analisada',
    body: report.status === 'resolved'
      ? `A equipe confirmou o problema${about} e tomou providências. Obrigado por avisar.`
      : `A equipe analisou a denúncia${about} e não encontrou quebra das regras. Obrigado por avisar.`,
    url: helpUrl(report.reporter.role)
  };
}

// Decisão da equipe: procedente (`resolved`) ou descartada (`dismissed`). Remover a conta ou editar o
// perfil denunciado é feito na administração de usuários; aqui fica o registro da decisão.
export class ReviewReportUseCase {
  constructor(private readonly deps: ReportDeps) {}

  async execute({ id, input }: { id: number; input: ReportReviewInput }): Promise<Result<AdminReport>> {
    const { reports, clock, push } = this.deps;
    const report = await reports.findById(id);
    if (!report) return notFound('Denúncia não encontrada.');
    if (report.status !== 'open') return conflict('Esta denúncia já foi analisada.');

    const reviewed: ReportRecord = { ...report, status: input.status, resolution_note: input.note ?? null, reviewed_at: clock.now() };
    await reports.update(reviewed);
    const result = await toAdminReport(this.deps, reviewed);
    push.notify(report.reporter_role, report.reporter_id, reviewedMessage(result));
    return ok(result);
  }
}
