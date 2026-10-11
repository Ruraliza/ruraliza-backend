import type { AccessPolicies } from '#modules/auth';
import type { Clock } from '#shared/domain/clock';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { SessionTokens } from '#shared/domain/tokens';
import { CreateSystemUserUseCase } from './application/create-system-user.usecase';
import { EnsureInitialAdminUseCase } from './application/ensure-initial-admin.usecase';
import { GetSystemUserUseCase } from './application/get-system-user.usecase';
import { ListSystemUsersUseCase } from './application/list-system-users.usecase';
import { SystemLoginUseCase } from './application/system-login.usecase';
import { UpdateOwnSystemUserUseCase, UpdateSystemUserByAdminUseCase } from './application/update-system-user.usecase';
import type { SystemUserRepository } from './domain/system-user';
import { createSystemUserController } from './presentation/system-user.controller';
import { type SystemUserRoutes, systemUserRoutes } from './presentation/system-user.routes';

export interface SystemUsersModuleDeps {
  systemUsers: SystemUserRepository;
  clock: Clock;
  passwords: PasswordHasher;
}

export interface SystemUserUseCases {
  systemLogin: SystemLoginUseCase;
  getSystemUser: GetSystemUserUseCase;
  listSystemUsers: ListSystemUsersUseCase;
  createSystemUser: CreateSystemUserUseCase;
  updateOwnSystemUser: UpdateOwnSystemUserUseCase;
  updateSystemUserByAdmin: UpdateSystemUserByAdminUseCase;
  ensureInitialAdmin: EnsureInitialAdminUseCase;
}

// Casos de uso da equipe do Ruraliza (administradores e tutores), montados pelo container.
export function createSystemUserUseCases(deps: SystemUsersModuleDeps): SystemUserUseCases {
  const createSystemUser = new CreateSystemUserUseCase(deps);
  return {
    systemLogin: new SystemLoginUseCase(deps),
    getSystemUser: new GetSystemUserUseCase(deps),
    listSystemUsers: new ListSystemUsersUseCase(deps),
    createSystemUser,
    updateOwnSystemUser: new UpdateOwnSystemUserUseCase(deps),
    updateSystemUserByAdmin: new UpdateSystemUserByAdminUseCase(deps),
    ensureInitialAdmin: new EnsureInitialAdminUseCase({ createSystemUser })
  };
}

// Rotas HTTP da equipe (login e perfil em /api/auth, cadastro em /api/admin).
export function createSystemUserRoutes(useCases: SystemUserUseCases, tokens: SessionTokens, access: AccessPolicies): SystemUserRoutes {
  return systemUserRoutes(createSystemUserController(useCases, tokens), access);
}
