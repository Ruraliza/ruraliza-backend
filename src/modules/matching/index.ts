// API pública do módulo de vagas para você (recomendações e avisos de vaga): o único arquivo que outros
// módulos enxergam (#modules/matching).
export type * from './matching.contract';
export type { JobAlertRecord, JobAlertRepository } from './domain/job-alert';
export type { CatalogNoticeStore } from './domain/catalog-notice';
export type { JobPreferencesRecord, JobPreferencesRepository } from './domain/job-preferences';
export { CATALOG_NOTICE } from './application/catalog-notices';
export { CATALOG_LIMIT } from './application/catalog.usecase';
export type { MatchingRoutes } from './presentation/matching.routes';
export { createInMemoryCatalogNoticeStore, createInMemoryJobAlertRepository, createInMemoryJobPreferencesRepository } from './infra/in-memory-matching.repositories';
export { createPgCatalogNoticeStore } from './infra/pg-catalog-notices';
export { createPgJobAlertRepository, createPgJobPreferencesRepository } from './infra/pg-matching.repositories';
export { type MatchingSchemaName, matchingSchemas } from './presentation/matching.schemas';
export { type MatchingModuleDeps, type MatchingUseCases, createMatchingRoutes, createMatchingUseCases } from './matching.module';
