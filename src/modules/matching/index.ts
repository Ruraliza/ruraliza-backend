// API pública do módulo de vagas para você (recomendações e avisos de vaga): o único arquivo que outros
// módulos enxergam (#modules/matching).
export type * from './matching.contract';
export type { JobAlertRecord, JobAlertRepository } from './domain/job-alert';
export type { JobPreferencesRecord, JobPreferencesRepository } from './domain/job-preferences';
export { createInMemoryJobAlertRepository, createInMemoryJobPreferencesRepository } from './infra/in-memory-matching.repositories';
export { type MatchingSchemaName, matchingSchemas } from './presentation/matching.schemas';
export { type MatchingModuleDeps, type MatchingUseCases, createMatchingRoutes, createMatchingUseCases } from './matching.module';
