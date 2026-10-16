import type { AccessPolicies } from '#modules/auth';
import type { FarmerRepository } from '#modules/farmers';
import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository } from '#modules/hiring';
import type { PushNotifier } from '#modules/notifications';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { CancelServiceUseCase } from './application/cancel-service.usecase';
import { GetOpenServiceUseCase } from './application/get-open-service.usecase';
import { GetServiceUseCase } from './application/get-service.usecase';
import { ListFarmerServicesUseCase } from './application/list-farmer-services.usecase';
import { PublishServiceUseCase } from './application/publish-service.usecase';
import { SearchOpenServicesUseCase } from './application/search-open-services.usecase';
import { UpdateServiceUseCase } from './application/update-service.usecase';
import type { FarmReputationReader } from './domain/farm-reputation';
import type { FarmerVerificationReader } from './domain/farmer-verification';
import type { ServiceRepository } from './domain/service.repository';
import { createJobController } from './presentation/job.controller';
import { createServiceController } from './presentation/service.controller';
import { type ServiceRoutes, serviceRoutes } from './presentation/service.routes';

export interface ServicesModuleDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
  reputation: FarmReputationReader;
  verification: FarmerVerificationReader;
}

export interface ServiceUseCases {
  publishService: PublishServiceUseCase;
  updateService: UpdateServiceUseCase;
  cancelService: CancelServiceUseCase;
  getService: GetServiceUseCase;
  listFarmerServices: ListFarmerServicesUseCase;
  searchOpenServices: SearchOpenServicesUseCase;
  getOpenService: GetOpenServiceUseCase;
}

// Casos de uso dos serviços e vagas (montados pelo container).
export function createServiceUseCases(deps: ServicesModuleDeps): ServiceUseCases {
  return {
    publishService: new PublishServiceUseCase(deps),
    updateService: new UpdateServiceUseCase(deps),
    cancelService: new CancelServiceUseCase(deps),
    getService: new GetServiceUseCase(deps),
    listFarmerServices: new ListFarmerServicesUseCase(deps),
    searchOpenServices: new SearchOpenServicesUseCase(deps),
    getOpenService: new GetOpenServiceUseCase(deps)
  };
}

// Rotas HTTP dos serviços (produtor, em /api/farmers) e das vagas (trabalhador, em /api/workers).
export function createServiceRoutes(useCases: ServiceUseCases, access: AccessPolicies): ServiceRoutes {
  return serviceRoutes(createServiceController(useCases), createJobController(useCases), access);
}
