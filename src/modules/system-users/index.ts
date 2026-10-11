// API pública do módulo da equipe (usuários de sistema): o único arquivo que outros módulos enxergam (#modules/system-users).
export type * from './system-user.contract';
export {
  SYSTEM_PERMISSIONS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_LABEL,
  type SystemPermission,
  type SystemUserRecord,
  type SystemUserRepository,
  canDo,
  toSystemUser
} from './domain/system-user';
export { createInMemorySystemUserRepository } from './infra/in-memory-system-user.repository';
export { systemActor, systemUserId } from './presentation/system-principal';
export type { SystemUserRoutes } from './presentation/system-user.routes';
export { type SystemUserSchemaName, systemUserSchemas } from './presentation/system-user.schemas';
export { type SystemUserUseCases, type SystemUsersModuleDeps, createSystemUserRoutes, createSystemUserUseCases } from './system-users.module';
