// API pública do módulo de produtores: o único arquivo que outros módulos enxergam (#modules/farmers).
export type * from './farmer.contract';
export type { NewFarmerProfile } from './application/create-farmer-profile.usecase';
export type { FarmerRepository } from './domain/farmer.repository';
export { createInMemoryFarmerRepository } from './infra/in-memory-farmer.repository';
export { type FarmerSchemaName, farmerSchema, farmerSchemas } from './presentation/farmer.schemas';
export { type FarmerUseCases, type FarmersModuleDeps, createFarmerRoutes, createFarmerUseCases } from './farmers.module';
