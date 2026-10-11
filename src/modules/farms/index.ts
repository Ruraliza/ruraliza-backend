// API pública do módulo de fazendas: o único arquivo que outros módulos enxergam (#modules/farms).
export type * from './farm.contract';
export type { FarmRepository } from './domain/farm.repository';
export { farmOf, findActiveFarm, isActiveFarm } from './domain/farm.rules';
export { createInMemoryFarmRepository } from './infra/in-memory-farm.repository';
export { type FarmSchemaName, farmSchemas } from './presentation/farm.schemas';
export { type FarmUseCases, type FarmsModuleDeps, createFarmRoutes, createFarmUseCases } from './farms.module';
