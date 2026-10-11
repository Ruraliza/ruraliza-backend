import { type Result, notFound, ok } from '#shared/domain/result';
import type { SessionUser } from '../accounts.contract';
import type { AccountRepository } from '../domain/account';
import { toSession } from '../domain/account.rules';

export interface GetAccountDeps {
  accounts: AccountRepository;
}

// Sessão da conta: perfis e painel aberto.
export class GetAccountUseCase {
  constructor(private readonly deps: GetAccountDeps) {}

  async execute({ accountId }: { accountId: number }): Promise<Result<SessionUser>> {
    const account = await this.deps.accounts.findById(accountId);
    return account ? ok(toSession(account)) : notFound('Conta não encontrada.');
  }
}
