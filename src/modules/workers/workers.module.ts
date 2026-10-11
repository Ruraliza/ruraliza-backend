import type { AccountRepository } from '#modules/accounts';
import type { AccessPolicies } from '#modules/auth';
import type { FarmerRepository } from '#modules/farmers';
import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository } from '#modules/hiring';
import type { PushSubscriptionRepository } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import type { Clock } from '#shared/domain/clock';
import type { DocumentStore } from '#shared/domain/documents';
import type { ImageStore } from '#shared/domain/images';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { SessionTokens } from '#shared/domain/tokens';
import { CreateWorkerProfileUseCase } from './application/create-worker-profile.usecase';
import { DeleteWorkerUseCase } from './application/delete-worker.usecase';
import { GetDocumentUseCase } from './application/get-document.usecase';
import { GetWorkerUseCase } from './application/get-worker.usecase';
import { ListWorkerApplicationsUseCase } from './application/list-worker-applications.usecase';
import { ListWorkerServicesUseCase } from './application/list-worker-services.usecase';
import { ListWorkersUseCase } from './application/list-workers.usecase';
import { RegisterWorkerUseCase } from './application/register-worker.usecase';
import { RemoveWorkerResumeUseCase } from './application/remove-worker-resume.usecase';
import { SetWorkerResumeUseCase } from './application/set-worker-resume.usecase';
import { UpdateWorkerUseCase } from './application/update-worker.usecase';
import { WatchWorkerApplicationsUseCase } from './application/watch-worker-applications.usecase';
import type { WorkerRepository } from './domain/worker.repository';
import { createResumeController } from './presentation/resume.controller';
import { createWorkerController } from './presentation/worker.controller';
import { type WorkerRoutes, workerRoutes } from './presentation/worker.routes';

export interface WorkersModuleDeps {
  workers: WorkerRepository;
  farmers: FarmerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  clock: Clock;
  images: ImageStore;
  documents: DocumentStore;
  passwords: PasswordHasher;
  changes: ChangeFeed;
  // Conversas e avaliações do perfil removido (ligado pelo container).
  cleanup: ProfileCleanup;
}

export interface WorkerUseCases {
  listWorkers: ListWorkersUseCase;
  getWorker: GetWorkerUseCase;
  registerWorker: RegisterWorkerUseCase;
  createWorkerProfile: CreateWorkerProfileUseCase;
  updateWorker: UpdateWorkerUseCase;
  deleteWorker: DeleteWorkerUseCase;
  listWorkerApplications: ListWorkerApplicationsUseCase;
  watchWorkerApplications: WatchWorkerApplicationsUseCase;
  listWorkerServices: ListWorkerServicesUseCase;
  getDocument: GetDocumentUseCase;
  setWorkerResume: SetWorkerResumeUseCase;
  removeWorkerResume: RemoveWorkerResumeUseCase;
}

// Casos de uso dos trabalhadores (montados pelo container).
export function createWorkerUseCases(deps: WorkersModuleDeps): WorkerUseCases {
  const createWorkerProfile = new CreateWorkerProfileUseCase(deps);
  return {
    listWorkers: new ListWorkersUseCase(deps),
    getWorker: new GetWorkerUseCase(deps),
    registerWorker: new RegisterWorkerUseCase({ ...deps, createProfile: createWorkerProfile }),
    createWorkerProfile,
    updateWorker: new UpdateWorkerUseCase(deps),
    deleteWorker: new DeleteWorkerUseCase(deps),
    listWorkerApplications: new ListWorkerApplicationsUseCase(deps),
    watchWorkerApplications: new WatchWorkerApplicationsUseCase(deps),
    listWorkerServices: new ListWorkerServicesUseCase(deps),
    getDocument: new GetDocumentUseCase(deps),
    setWorkerResume: new SetWorkerResumeUseCase(deps),
    removeWorkerResume: new RemoveWorkerResumeUseCase(deps)
  };
}

// Rotas HTTP do trabalhador (em /api/workers) e dos currículos (em /api/documents).
export function createWorkerRoutes(useCases: WorkerUseCases, tokens: SessionTokens, access: AccessPolicies): WorkerRoutes {
  return workerRoutes(createWorkerController(useCases, tokens), createResumeController(useCases), access);
}
