import type { AccountRepository } from '#modules/accounts';
import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository } from '#modules/hiring';
import type { PushSubscriptionRepository } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import type { ImageStore } from '#shared/domain/images';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { SessionTokens } from '#shared/domain/tokens';
import type { RouteDef } from '#shared/infra/http/route';
import type { WorkerRepository } from '../../domain/repositories';
import type { AccessPolicies } from '../../http/access';
import { CreateFarmerProfileUseCase } from './application/create-farmer-profile.usecase';
import { DeleteFarmerUseCase } from './application/delete-farmer.usecase';
import { GetFarmerUseCase } from './application/get-farmer.usecase';
import { ListFarmersUseCase } from './application/list-farmers.usecase';
import { RegisterFarmerUseCase } from './application/register-farmer.usecase';
import { UpdateFarmerUseCase } from './application/update-farmer.usecase';
import type { FarmerRepository } from './domain/farmer.repository';
import { createFarmerController } from './presentation/farmer.controller';
import { farmerRoutes } from './presentation/farmer.routes';

export interface FarmersModuleDeps {
  farmers: FarmerRepository;
  workers: WorkerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  clock: Clock;
  images: ImageStore;
  passwords: PasswordHasher;
  changes: ChangeFeed;
}

export interface FarmerUseCases {
  listFarmers: ListFarmersUseCase;
  getFarmer: GetFarmerUseCase;
  registerFarmer: RegisterFarmerUseCase;
  createFarmerProfile: CreateFarmerProfileUseCase;
  updateFarmer: UpdateFarmerUseCase;
  deleteFarmer: DeleteFarmerUseCase;
}

// Casos de uso dos produtores (montados pelo container).
export function createFarmerUseCases(deps: FarmersModuleDeps): FarmerUseCases {
  const createFarmerProfile = new CreateFarmerProfileUseCase(deps);
  return {
    listFarmers: new ListFarmersUseCase(deps),
    getFarmer: new GetFarmerUseCase(deps),
    registerFarmer: new RegisterFarmerUseCase({ ...deps, createProfile: createFarmerProfile }),
    createFarmerProfile,
    updateFarmer: new UpdateFarmerUseCase(deps),
    deleteFarmer: new DeleteFarmerUseCase(deps)
  };
}

// Rotas HTTP do cadastro e perfil (em /api/farmers). O cadastro devolve o token da conta nova.
export function createFarmerRoutes(useCases: FarmerUseCases, tokens: SessionTokens, access: AccessPolicies): readonly RouteDef[] {
  return farmerRoutes(createFarmerController(useCases, tokens), access);
}
