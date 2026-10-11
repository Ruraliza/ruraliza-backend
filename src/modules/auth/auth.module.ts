import type { AccountRepository } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { SessionTokens } from '#shared/domain/tokens';
import type { ResetTokens } from '#shared/domain/tokens';
import { ChangePasswordUseCase } from './application/change-password.usecase';
import { LoginUseCase } from './application/login.usecase';
import { RequestPasswordResetUseCase } from './application/request-password-reset.usecase';
import { ResetPasswordUseCase } from './application/reset-password.usecase';
import type { AccessPolicies } from './presentation/access';
import { createAuthController } from './presentation/auth.controller';
import { type AuthRoutes, authRoutes } from './presentation/auth.routes';

export interface AuthModuleDeps {
  accounts: AccountRepository;
  farmers: FarmerRepository;
  workers: WorkerRepository;
  clock: Clock;
  passwords: PasswordHasher;
  resetTokens: ResetTokens;
}

export interface AuthUseCases {
  login: LoginUseCase;
  requestPasswordReset: RequestPasswordResetUseCase;
  resetPassword: ResetPasswordUseCase;
  changePassword: ChangePasswordUseCase;
}

// Casos de uso do acesso às contas do app (montados pelo container).
export function createAuthUseCases(deps: AuthModuleDeps): AuthUseCases {
  return {
    login: new LoginUseCase(deps),
    requestPasswordReset: new RequestPasswordResetUseCase(deps),
    resetPassword: new ResetPasswordUseCase(deps),
    changePassword: new ChangePasswordUseCase(deps)
  };
}

// Rotas HTTP do acesso (login e redefinição em /api/auth; troca de senha nos perfis).
export function createAuthRoutes(useCases: AuthUseCases, tokens: SessionTokens, access: AccessPolicies): AuthRoutes {
  return authRoutes(createAuthController(useCases, tokens), access);
}
