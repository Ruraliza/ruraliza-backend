import type { ProfileCreateInput, SessionUser, UserRole } from '../contracts';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import { type AccountRepos, ROLE_LABEL, checkCpfForAccount, hasProfile, profileKey, toSession } from './accounts';
import type { FarmerUseCases } from './FarmerUseCases';
import type { WorkerUseCases } from './WorkerUseCases';

const ACCOUNT_NOT_FOUND = 'Conta não encontrada.';

// Conta única com dois painéis: criar o outro perfil e trocar o painel aberto.
export class AccountUseCases {
  constructor(
    private readonly repos: AccountRepos,
    private readonly profiles: { farmers: FarmerUseCases; workers: WorkerUseCases }
  ) {}

  async get(id: number): Promise<Result<SessionUser>> {
    const account = await this.repos.accounts.findById(id);
    return account ? ok(toSession(account)) : notFound(ACCOUNT_NOT_FOUND);
  }

  // Cria o perfil que falta, com o e-mail (e a senha) da conta, e já abre o painel dele.
  async addProfile(id: number, input: ProfileCreateInput): Promise<Result<SessionUser>> {
    const account = await this.repos.accounts.findById(id);
    if (!account) return notFound(ACCOUNT_NOT_FOUND);
    if (hasProfile(account, input.role)) return conflict(`Sua conta já tem um perfil de ${ROLE_LABEL[input.role]}.`);

    const cpf = await checkCpfForAccount(this.repos, account, input.cpf);
    if (!cpf.ok) return cpf;

    const base = { email: account.email, name: input.name, phone: input.phone, cpf: input.cpf };
    const profile =
      input.role === 'farmer'
        ? await this.profiles.farmers.createProfile(base)
        : await this.profiles.workers.createProfile({
            ...base,
            bio: input.bio ?? null,
            certificates: input.certificates ?? null,
            courses: input.courses ?? null,
            experience: input.experience ?? null
          });
    if (!profile.ok) return profile;

    // TODO(db): na mesma transação que cria o perfil.
    account[profileKey(input.role)] = profile.value.id;
    account.last_role = input.role;
    await this.repos.accounts.update(account);
    return ok(toSession(account));
  }

  // Troca o painel aberto (e o que abre no próximo login).
  async setActiveRole(id: number, role: UserRole): Promise<Result<SessionUser>> {
    const account = await this.repos.accounts.findById(id);
    if (!account) return notFound(ACCOUNT_NOT_FOUND);
    if (!hasProfile(account, role)) return notFound(`Sua conta ainda não tem um perfil de ${ROLE_LABEL[role]}.`);

    account.last_role = role;
    await this.repos.accounts.update(account);
    return ok(toSession(account));
  }
}
