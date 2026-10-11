import { type Result, notFound, ok } from '#shared/domain/result';
import type { SessionUser, UserRole } from '../accounts.contract';
import type { AccountRepository } from '../domain/account';
import { ROLE_LABEL, hasProfile, toSession } from '../domain/account.rules';

export interface SetActiveRoleDeps {
  accounts: AccountRepository;
}

export interface SetActiveRoleInput {
  accountId: number;
  role: UserRole;
}

// Troca o painel aberto (e o que abre no próximo login).
export class SetActiveRoleUseCase {
  constructor(private readonly deps: SetActiveRoleDeps) {}

  async execute({ accountId, role }: SetActiveRoleInput): Promise<Result<SessionUser>> {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) return notFound('Conta não encontrada.');
    if (!hasProfile(account, role)) return notFound(`Sua conta ainda não tem um perfil de ${ROLE_LABEL[role]}.`);

    account.last_role = role;
    await this.deps.accounts.update(account);
    return ok(toSession(account));
  }
}
