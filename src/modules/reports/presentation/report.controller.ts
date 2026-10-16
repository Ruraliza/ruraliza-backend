import type { UserRole } from '#modules/accounts';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { AdminReport, AdminReportResponse, ReportResponse } from '../report.contract';
import type { ReportUseCases } from '../reports.module';
import { parseReportInput, parseReportReview, parseReportStatusQuery } from './report.parsers';

// HTTP das denúncias: quem usa o app denuncia; a equipe analisa.
export interface ReportController {
  farmerReport: Handler<ReportResponse, IdParams>;
  workerReport: Handler<ReportResponse, IdParams>;
  listReports: Handler<AdminReport[]>;
  reviewReport: Handler<AdminReportResponse, IdParams>;
}

type Req = Parameters<Handler<never, IdParams>>[0];
type Res = Parameters<Handler<ReportResponse, IdParams>>[1];

export function createReportController(reports: ReportUseCases): ReportController {
  async function report(role: UserRole, req: Req, res: Res): Promise<void> {
    const input = parseReportInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await reports.create.execute({ role, profileId: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Report sent successfully!', report: result.value });
  }

  // POST /api/farmers/:id/reports - O produtor denuncia um trabalhador
  const farmerReport: Handler<ReportResponse, IdParams> = (req, res) => report('farmer', req, res);

  // POST /api/workers/:id/reports - O trabalhador denuncia uma vaga ou um produtor
  const workerReport: Handler<ReportResponse, IdParams> = (req, res) => report('worker', req, res);

  // GET /api/admin/reports?status= - Fila da equipe
  const listReports: Handler<AdminReport[]> = async (req, res) => {
    const status = parseReportStatusQuery(req.query['status']);
    if (!status.ok) { sendFailure(res, status); return; }
    res.status(200).json(await reports.list.execute({ status: status.value }));
  };

  // PATCH /api/admin/reports/:id - Procedente ou descartada
  const reviewReport: Handler<AdminReportResponse, IdParams> = async (req, res) => {
    const input = parseReportReview(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await reports.review.execute({ id: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Report reviewed successfully!', report: result.value });
  };

  return { farmerReport, workerReport, listReports, reviewReport };
}
