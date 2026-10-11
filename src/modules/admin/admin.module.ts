import type { AccountRepository } from '#modules/accounts';
import type { AccessPolicies } from '#modules/auth';
import type { FarmerRepository, FarmerUseCases } from '#modules/farmers';
import type { PhotoUseCases } from '#modules/media';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository, WorkerUseCases } from '#modules/workers';
import type { RouteDef } from '#shared/infra/http/route';
import { DeleteAccountUseCase } from './application/delete-account.usecase';
import { GetAccountDetailUseCase } from './application/get-account-detail.usecase';
import { ListAccountsUseCase } from './application/list-accounts.usecase';
import { createAdminController } from './presentation/admin.controller';
import { adminRoutes } from './presentation/admin.routes';

export interface AdminModuleDeps {
  accounts: AccountRepository;
  farmers: FarmerRepository;
  workers: WorkerRepository;
  services: ServiceRepository;
  farmerUseCases: Pick<FarmerUseCases, 'deleteFarmer'>;
  workerUseCases: Pick<WorkerUseCases, 'deleteWorker'>;
}

export interface AdminUseCases {
  listAccounts: ListAccountsUseCase;
  getAccountDetail: GetAccountDetailUseCase;
  deleteAccount: DeleteAccountUseCase;
}

// Gerenciamento das contas do app pelo administrador (montado pelo container). Editar e remover
// um perfil usam os casos de uso dos próprios módulos de perfis e de fotos.
export function createAdminUseCases(deps: AdminModuleDeps): AdminUseCases {
  return {
    listAccounts: new ListAccountsUseCase(deps),
    getAccountDetail: new GetAccountDetailUseCase(deps),
    deleteAccount: new DeleteAccountUseCase(deps)
  };
}

export interface AdminRouteUseCases {
  admin: AdminUseCases;
  farmers: FarmerUseCases;
  workers: WorkerUseCases;
  photos: PhotoUseCases;
}

// Rotas HTTP em /api/admin (a equipe vem do módulo system-users).
export function createAdminRoutes(useCases: AdminRouteUseCases, staffRoutes: readonly RouteDef[], access: AccessPolicies): readonly RouteDef[] {
  return adminRoutes(createAdminController(useCases), staffRoutes, access);
}
