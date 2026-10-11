import { requireFound } from '#shared/domain/result';
import type { SessionUser, UserRole } from '../accounts.contract';
import type { Account, AccountRepository } from './account';

// Regras da conta única: um e-mail e uma senha por pessoa, com até um perfil de cada tipo.

export const EMAIL_TAKEN = 'Já existe uma conta com este e-mail. Entre com ela e ative o outro perfil pelo menu.';
export const CPF_TAKEN = 'Já existe uma conta com este CPF. Entre com ela e ative o outro perfil pelo menu.';

export const ROLE_LABEL: Record<UserRole, string> = { farmer: 'produtor', worker: 'trabalhador' };

export function otherRole(role: UserRole): UserRole {
  return role === 'farmer' ? 'worker' : 'farmer';
}

// Campo da conta que aponta para o perfil do tipo `role`.
export function profileKey(role: UserRole): 'farmer_id' | 'worker_id' {
  return role === 'farmer' ? 'farmer_id' : 'worker_id';
}

export function hasProfile(account: Account, role: UserRole): boolean {
  return account[profileKey(role)] !== null;
}

// Painel que abre: o último usado, ou o único perfil que a conta tem.
function activeRole(account: Account): UserRole {
  return hasProfile(account, account.last_role) ? account.last_role : otherRole(account.last_role);
}

export function toSession(account: Account): SessionUser {
  const role = activeRole(account);
  const id = requireFound(account[profileKey(role)] ?? undefined, `perfil de ${ROLE_LABEL[role]} da conta ${account.id}`);
  return { account_id: account.id, role, id, profiles: { farmer: account.farmer_id, worker: account.worker_id } };
}

export async function findAccountByEmail(accounts: AccountRepository, email: string): Promise<Account | undefined> {
  const [account] = await accounts.find({ email });
  return account;
}

export async function findAccountOf(accounts: AccountRepository, role: UserRole, profileId: number): Promise<Account | undefined> {
  const [account] = await accounts.find(role === 'farmer' ? { farmer_id: profileId } : { worker_id: profileId });
  return account;
}
