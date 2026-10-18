// API pública do módulo de acesso: o único arquivo que outros módulos enxergam (#modules/auth).
export type * from './auth.contract';
export { RESET_TOKEN_TTL_MS, type ResetCodeDelivery } from './domain/reset-tokens';
export { type AccessDeps, type AccessPolicies, SESSION_EXPIRED, SIGN_IN_REQUIRED, createAccess } from './presentation/access';
export { parseLoginInput } from './presentation/auth.parsers';
export type { AuthRoutes } from './presentation/auth.routes';
export { type AuthSchemaName, authSchemas } from './presentation/auth.schemas';
export { type AuthModuleDeps, type AuthUseCases, createAuthRoutes, createAuthUseCases } from './auth.module';
