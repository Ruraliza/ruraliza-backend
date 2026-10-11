import type { AccountRepository } from '#modules/accounts';
import { toPublicProfile } from '#shared/utils/profile';
import type { AdminUser } from '../admin.contract';
import { type AdminUserRepos, toAdminUser } from './to-admin-user';

// Todas as contas do app com os perfis (CPF mascarado), as mais novas primeiro.
export class ListAccountsUseCase {
  constructor(private readonly deps: AdminUserRepos & { accounts: AccountRepository }) {}

  async execute(): Promise<AdminUser[]> {
    const accounts = await this.deps.accounts.find();
    const users = await Promise.all(accounts.map((account) => toAdminUser(this.deps, account)));
    return users.reverse().map((user) => ({
      ...user,
      farmer: user.farmer && toPublicProfile(user.farmer),
      worker: user.worker && toPublicProfile(user.worker)
    }));
  }
}
