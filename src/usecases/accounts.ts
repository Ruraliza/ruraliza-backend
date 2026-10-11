import type { SessionUser, UserRole } from '../contracts';
import type { Account } from '../domain/passwords';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { AccountRepository, FarmerRepository, PushSubscriptionRepository, WorkerRepository } from '../domain/repositories';
import { type Result, conflict, ok, requireFound } from '#shared/domain/result';

// Regras da conta única: um e-mail e uma senha por pessoa, com até um perfil de cada tipo.
// Funções soltas (como em ./shared) porque cadastro, edição e remoção dos perfis também mexem na conta.

export const EMAIL_TAKEN = 'Já existe uma conta com este e-mail. Entre com ela e ative o outro perfil pelo menu.';
export const CPF_TAKEN = 'Já existe uma conta com este CPF. Entre com ela e ative o outro perfil pelo menu.';

export const ROLE_LABEL: Record<UserRole, string> = { farmer: 'produtor', worker: 'trabalhador' };

export interface AccountRepos {
  accounts: AccountRepository;
  farmers: FarmerRepository;
  workers: WorkerRepository;
}

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

// Cadastro novo: o e-mail não pode ter conta, e o CPF não pode estar em nenhum perfil.
export async function checkNewAccount(repos: AccountRepos, email: string, cpf: string): Promise<Result<null>> {
  if (await findAccountByEmail(repos.accounts, email)) return conflict(EMAIL_TAKEN);
  const sameCpf = [...(await repos.farmers.find({ cpf })), ...(await repos.workers.find({ cpf }))];
  return sameCpf.length > 0 ? conflict(CPF_TAKEN) : ok(null);
}

// Segundo perfil numa conta existente: o CPF só pode estar nos perfis desta mesma conta.
export async function checkCpfForAccount(repos: AccountRepos, account: Account, cpf: string): Promise<Result<null>> {
  const others = [
    ...(await repos.farmers.find({ cpf })).filter((p) => p.id !== account.farmer_id),
    ...(await repos.workers.find({ cpf })).filter((p) => p.id !== account.worker_id)
  ];
  return others.length > 0 ? conflict(CPF_TAKEN) : ok(null);
}

// Conta criada junto com o primeiro perfil, no cadastro.
// TODO(db): na mesma transação que cria o perfil.
export async function createAccount(
  accounts: AccountRepository,
  hasher: PasswordHasher,
  input: { email: string; password: string; role: UserRole; profileId: number }
): Promise<Account> {
  return accounts.create({
    email: input.email,
    password_hash: await hasher.hash(input.password),
    reset_token_digest: null,
    reset_expires_at: null,
    farmer_id: input.role === 'farmer' ? input.profileId : null,
    worker_id: input.role === 'worker' ? input.profileId : null,
    last_role: input.role
  });
}

// E-mail trocado na edição de um perfil: vale para a conta e para o outro perfil dela.
export async function changeAccountEmail(repos: AccountRepos, role: UserRole, profileId: number, email: string): Promise<Result<null>> {
  const account = requireFound(await findAccountOf(repos.accounts, role, profileId), `conta do ${ROLE_LABEL[role]} ${profileId}`);
  if (account.email === email) return ok(null);

  const owner = await findAccountByEmail(repos.accounts, email);
  if (owner && owner.id !== account.id) return conflict('Já existe uma conta com este e-mail.');

  // TODO(db): numa transação.
  account.email = email;
  await repos.accounts.update(account);
  const siblingId = account[profileKey(otherRole(role))];
  if (siblingId !== null) {
    if (role === 'farmer') {
      const worker = requireFound(await repos.workers.findById(siblingId), `trabalhador ${siblingId}`);
      await repos.workers.update({ ...worker, email });
    } else {
      const farmer = requireFound(await repos.farmers.findById(siblingId), `produtor ${siblingId}`);
      await repos.farmers.update({ ...farmer, email });
    }
  }
  return ok(null);
}

// Perfil removido: sai da conta. A conta só some junto com o último perfil (e leva as inscrições de push).
export async function unlinkProfile(
  repos: { accounts: AccountRepository; pushSubscriptions: PushSubscriptionRepository },
  role: UserRole,
  profileId: number
): Promise<void> {
  const { accounts, pushSubscriptions } = repos;
  const account = await findAccountOf(accounts, role, profileId);
  if (!account) return;

  account[profileKey(role)] = null;
  if (hasProfile(account, otherRole(role))) {
    account.last_role = otherRole(role);
    await accounts.update(account);
  } else {
    // TODO(db): ON DELETE CASCADE.
    for (const sub of await pushSubscriptions.find({ account_id: account.id })) await pushSubscriptions.delete(sub.id);
    await accounts.delete(account.id);
  }
}
