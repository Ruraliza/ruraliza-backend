// API pública do módulo de denúncias: o único arquivo que outros módulos enxergam (#modules/reports).
export type * from './report.contract';
export type { ReportRecord, ReportRepository } from './domain/report';
export { createInMemoryReportRepository } from './infra/in-memory-report.repository';
export type { ReportRoutes } from './presentation/report.routes';
export { type ReportSchemaName, reportSchemas } from './presentation/report.schemas';
export { type ReportUseCases, type ReportsModuleDeps, createReportRoutes, createReportUseCases } from './reports.module';
