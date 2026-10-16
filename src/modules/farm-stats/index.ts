// Painel da fazenda (#modules/farm-stats): os números do produtor.
import type { AccessPolicies } from '#modules/auth';
import type { RouteDef } from '#shared/infra/http/route';
import { type FarmStatsDeps, GetFarmerStatsUseCase } from './application/get-farmer-stats.usecase';
import { createFarmStatsController } from './presentation/farm-stats.controller';
import { farmStatsRoutes } from './presentation/farm-stats.routes';

export type * from './farm-stats.contract';
export type { FarmStatsDeps } from './application/get-farmer-stats.usecase';
export { type FarmStatsSchemaName, farmStatsSchemas } from './presentation/farm-stats.schemas';

export interface FarmStatsUseCases {
  farmerStats: GetFarmerStatsUseCase;
}

export function createFarmStatsUseCases(deps: FarmStatsDeps): FarmStatsUseCases {
  return { farmerStats: new GetFarmerStatsUseCase(deps) };
}

export function createFarmStatsRoutes(useCases: FarmStatsUseCases, access: AccessPolicies): readonly RouteDef[] {
  return farmStatsRoutes(createFarmStatsController(useCases.farmerStats), access);
}
