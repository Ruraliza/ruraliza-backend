// API pública do módulo de patrocínios: o único arquivo que outros módulos enxergam (#modules/sponsors).
export type * from './sponsor.contract';
export type { SponsorRecord, SponsorRepository } from './domain/sponsor';
export { createInMemorySponsorRepository } from './infra/in-memory-sponsor.repository';
export type { SponsorRoutes } from './presentation/sponsor.routes';
export { type SponsorSchemaName, sponsorSchemas } from './presentation/sponsor.schemas';
export { type SponsorUseCases, type SponsorsModuleDeps, createSponsorRoutes, createSponsorUseCases } from './sponsors.module';
