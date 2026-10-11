// API pública do módulo de administração das contas: o único arquivo que outros módulos enxergam (#modules/admin).
export type * from './admin.contract';
export { type AdminSchemaName, adminSchemas } from './presentation/admin.schemas';
export { type AdminModuleDeps, type AdminRouteUseCases, type AdminUseCases, createAdminRoutes, createAdminUseCases } from './admin.module';
