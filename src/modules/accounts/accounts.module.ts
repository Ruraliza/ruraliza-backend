import type { RouteDef } from '#shared/infra/http/route';
import type { AccessPolicies } from '../../http/access';
import type { AccountRepos } from './application/account-profiles';
import { AddProfileUseCase } from './application/add-profile.usecase';
import { GetAccountUseCase } from './application/get-account.usecase';
import { SetActiveRoleUseCase } from './application/set-active-role.usecase';
import type { ProfileFactory } from './domain/profile-factory';
import { createAccountController } from './presentation/account.controller';
import { accountRoutes } from './presentation/account.routes';

export interface AccountsModuleDeps extends AccountRepos {
  profiles: ProfileFactory;
}

export interface AccountUseCases {
  getAccount: GetAccountUseCase;
  addProfile: AddProfileUseCase;
  setActiveRole: SetActiveRoleUseCase;
}

// Casos de uso da conta única com dois painéis (montados pelo container).
export function createAccountUseCases(deps: AccountsModuleDeps): AccountUseCases {
  return {
    getAccount: new GetAccountUseCase(deps),
    addProfile: new AddProfileUseCase(deps),
    setActiveRole: new SetActiveRoleUseCase(deps)
  };
}

// Rotas HTTP em /api/accounts (as inscrições de push vêm do módulo de notificações).
export function createAccountRoutes(useCases: AccountUseCases, pushRoutes: readonly RouteDef[], access: AccessPolicies): readonly RouteDef[] {
  return accountRoutes(createAccountController(useCases), pushRoutes, access);
}
