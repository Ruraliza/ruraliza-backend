import type { AdminReport, ReportStatus } from '../report.contract';
import { type ReportDeps, toAdminReport } from './report-deps';

// Fila da equipe: a mais recente primeiro; `status` filtra (sem ele, todas).
export class ListReportsUseCase {
  constructor(private readonly deps: ReportDeps) {}

  async execute({ status }: { status?: ReportStatus | undefined } = {}): Promise<AdminReport[]> {
    const records = await this.deps.reports.find(status ? { status } : {});
    records.sort((a, b) => b.id - a.id);
    return Promise.all(records.map((record) => toAdminReport(this.deps, record)));
  }
}
