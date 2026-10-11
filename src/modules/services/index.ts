// API pública do módulo de serviços (vagas): o único arquivo que outros módulos enxergam (#modules/services).
export type * from './service.contract';
export { CATEGORIES } from './domain/categories';
export type { FarmReputationReader } from './domain/farm-reputation';
export type { ServiceRepository } from './domain/service.repository';
export { SERVICE_STATUS, isServiceStatus, serviceStatusList } from './domain/service-status';
export { isExpired, toOpenService } from './domain/service.rules';
export { createInMemoryServiceRepository } from './infra/in-memory-service.repository';
export { categoryRoutes } from './presentation/category.routes';
export type { ServiceRoutes } from './presentation/service.routes';
export { type ServiceSchemaName, serviceSchemas } from './presentation/service.schemas';
export { type ServiceUseCases, type ServicesModuleDeps, createServiceRoutes, createServiceUseCases } from './services.module';
