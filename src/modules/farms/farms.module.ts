import type { Clock } from '#shared/domain/clock';
import type { RouteDef } from '#shared/infra/http/route';
import type { ServiceRepository } from '#modules/services';
import type { FarmerRepository } from '../../domain/repositories';
import type { AccessPolicies } from '../../http/access';
import { CreateFarmUseCase } from './application/create-farm.usecase';
import { DeleteFarmUseCase } from './application/delete-farm.usecase';
import { ListFarmsUseCase } from './application/list-farms.usecase';
import { UpdateFarmUseCase } from './application/update-farm.usecase';
import type { FarmRepository } from './domain/farm.repository';
import { createFarmController } from './presentation/farm.controller';
import { farmRoutes } from './presentation/farm.routes';

export interface FarmsModuleDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  clock: Clock;
}

export interface FarmUseCases {
  listFarms: ListFarmsUseCase;
  createFarm: CreateFarmUseCase;
  updateFarm: UpdateFarmUseCase;
  deleteFarm: DeleteFarmUseCase;
}

// Casos de uso das fazendas (montados pelo container).
export function createFarmUseCases(deps: FarmsModuleDeps): FarmUseCases {
  return {
    listFarms: new ListFarmsUseCase(deps),
    createFarm: new CreateFarmUseCase(deps),
    updateFarm: new UpdateFarmUseCase(deps),
    deleteFarm: new DeleteFarmUseCase(deps)
  };
}

// Rotas HTTP das fazendas (montadas em /api/farmers por src/routes).
export function createFarmRoutes(useCases: FarmUseCases, access: AccessPolicies): readonly RouteDef[] {
  return farmRoutes(createFarmController(useCases), access);
}
