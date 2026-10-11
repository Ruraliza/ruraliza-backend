import type { ServiceRepository } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import type { PushNotifier } from '../../domain/push';
import type { AccountRepository, WorkerRepository } from '../../domain/repositories';
import type { AccessPolicies } from '../../http/access';
import { AnalyzeApplicationUseCase } from './application/analyze-application.usecase';
import { ApplyForServiceUseCase } from './application/apply-for-service.usecase';
import { ListServiceApplicationsUseCase } from './application/list-service-applications.usecase';
import { PayServiceUseCase } from './application/pay-service.usecase';
import { WatchServiceApplicationsUseCase } from './application/watch-service-applications.usecase';
import { WithdrawFromServiceUseCase } from './application/withdraw-from-service.usecase';
import type { ApplicationRepository } from './domain/application.repository';
import type { PaymentRepository } from './domain/payment.repository';
import { createHiringController } from './presentation/hiring.controller';
import { type HiringRoutes, hiringRoutes } from './presentation/hiring.routes';

export interface HiringModuleDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  payments: PaymentRepository;
  workers: WorkerRepository;
  accounts: AccountRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

export interface HiringUseCases {
  applyForService: ApplyForServiceUseCase;
  analyzeApplication: AnalyzeApplicationUseCase;
  withdrawFromService: WithdrawFromServiceUseCase;
  payService: PayServiceUseCase;
  listServiceApplications: ListServiceApplicationsUseCase;
  watchServiceApplications: WatchServiceApplicationsUseCase;
}

// Casos de uso da contratação (montados pelo container). Cada um altera várias entidades juntas
// e, no fim, avisa as telas abertas (`changes`) e manda push para quem precisa agir ou saber (`push`).
export function createHiringUseCases(deps: HiringModuleDeps): HiringUseCases {
  return {
    applyForService: new ApplyForServiceUseCase(deps),
    analyzeApplication: new AnalyzeApplicationUseCase(deps),
    withdrawFromService: new WithdrawFromServiceUseCase(deps),
    payService: new PayServiceUseCase(deps),
    listServiceApplications: new ListServiceApplicationsUseCase(deps),
    watchServiceApplications: new WatchServiceApplicationsUseCase(deps)
  };
}

// Rotas HTTP da contratação (produtor em /api/farmers, trabalhador em /api/workers).
export function createHiringRoutes(useCases: HiringUseCases, access: AccessPolicies): HiringRoutes {
  return hiringRoutes(createHiringController(useCases), access);
}
