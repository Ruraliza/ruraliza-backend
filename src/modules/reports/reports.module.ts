import type { AccessPolicies } from '#modules/auth';
import { CreateReportUseCase } from './application/create-report.usecase';
import { ListReportsUseCase } from './application/list-reports.usecase';
import type { ReportDeps } from './application/report-deps';
import { ReviewReportUseCase } from './application/review-report.usecase';
import { createReportController } from './presentation/report.controller';
import { type ReportRoutes, reportRoutes } from './presentation/report.routes';

export type ReportsModuleDeps = ReportDeps;

export interface ReportUseCases {
  create: CreateReportUseCase;
  list: ListReportsUseCase;
  review: ReviewReportUseCase;
}

// Casos de uso das denúncias (montados pelo container).
export function createReportUseCases(deps: ReportsModuleDeps): ReportUseCases {
  return {
    create: new CreateReportUseCase(deps),
    list: new ListReportsUseCase(deps),
    review: new ReviewReportUseCase(deps)
  };
}

// Rotas HTTP (denunciar em /api/farmers e /api/workers; a fila em /api/admin/reports).
export function createReportRoutes(useCases: ReportUseCases, access: AccessPolicies): ReportRoutes {
  return reportRoutes(createReportController(useCases), access);
}
