import { type Result, notFound, ok } from '#shared/domain/result';
import type { AccountPreferences } from '../accounts.contract';
import type { AccountRepository } from '../domain/account';
import { preferencesOf } from '../domain/preferences';

export interface PreferencesDeps {
  accounts: AccountRepository;
}

// Preferências de exibição da conta (os padrões, se ela nunca mudou nada).
export class GetPreferencesUseCase {
  constructor(private readonly deps: PreferencesDeps) {}

  async execute({ accountId }: { accountId: number }): Promise<Result<AccountPreferences>> {
    const account = await this.deps.accounts.findById(accountId);
    return account ? ok(preferencesOf(account)) : notFound('Conta não encontrada.');
  }
}
