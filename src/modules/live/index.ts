// Avisos em tempo real por perfil (SSE): uma conexão só por aba (#modules/live).
import type { AccessPolicies } from '#modules/auth';
import type { ChangeFeed } from '#shared/domain/changes';
import { createLiveController } from './presentation/live.controller';
import { type LiveRoutes, liveRoutes } from './presentation/live.routes';

export type { LiveRoutes } from './presentation/live.routes';

export function createLiveRoutes(changes: ChangeFeed, access: AccessPolicies): LiveRoutes {
  return liveRoutes(createLiveController(changes), access);
}
