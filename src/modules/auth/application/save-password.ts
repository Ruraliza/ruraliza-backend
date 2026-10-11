import type { Account, AccountRepository } from '#modules/accounts';
import type { PasswordHasher } from '#shared/domain/passwords';

// Grava a senha nova da conta. Trocar a senha também cancela uma redefinição pendente.
export async function savePassword(deps: { accounts: AccountRepository; passwords: PasswordHasher }, account: Account, password: string): Promise<void> {
  account.password_hash = await deps.passwords.hash(password);
  account.reset_token_digest = null;
  account.reset_expires_at = null;
  await deps.accounts.update(account);
}
