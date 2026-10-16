import { type Result, notFound, ok } from '#shared/domain/result';
import type { AccountPreferences, AccountPreferencesInput } from '../accounts.contract';
import { preferencesOf } from '../domain/preferences';
import type { PreferencesDeps } from './get-preferences.usecase';

export interface UpdatePreferencesInput {
  accountId: number;
  changes: AccountPreferencesInput;
}

// Muda só o que veio; o resto continua como estava.
export class UpdatePreferencesUseCase {
  constructor(private readonly deps: PreferencesDeps) {}

  async execute({ accountId, changes }: UpdatePreferencesInput): Promise<Result<AccountPreferences>> {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) return notFound('Conta não encontrada.');

    const preferences = { ...preferencesOf(account), ...changes };
    await this.deps.accounts.update({ ...account, preferences });
    return ok(preferences);
  }
}
