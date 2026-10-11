// API pública do módulo da plataforma (estado do servidor e configuração do mapa) (#modules/platform).
export type * from './platform.contract';
export { platformRoutes } from './presentation/platform.routes';
export { type PlatformSchemaName, platformSchemas } from './presentation/platform.schemas';
