import type { AccountRepository } from '#modules/accounts';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { AdminUser } from '../admin.contract';
import { type AdminUserRepos, toAdminUser } from './to-admin-user';

// Uma conta com os perfis completos (CPF sem máscara).
export class GetAccountDetailUseCase {
  constructor(private readonly deps: AdminUserRepos & { accounts: AccountRepository }) {}

  async execute({ accountId }: { accountId: number }): Promise<Result<AdminUser>> {
    const account = await this.deps.accounts.findById(accountId);
    return account ? ok(await toAdminUser(this.deps, account)) : notFound('Conta não encontrada.');
  }
}
