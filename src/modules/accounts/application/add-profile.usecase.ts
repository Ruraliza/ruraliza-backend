import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { ProfileCreateInput, SessionUser } from '../accounts.contract';
import { ROLE_LABEL, hasProfile, profileKey, toSession } from '../domain/account.rules';
import type { ProfileFactory } from '../domain/profile-factory';
import { type AccountRepos, checkCpfForAccount } from './account-profiles';

export interface AddProfileDeps extends AccountRepos {
  profiles: ProfileFactory;
}

export interface AddProfileInput {
  accountId: number;
  input: ProfileCreateInput;
}

// Cria o perfil que falta, com o e-mail (e a senha) da conta, e já abre o painel dele.
export class AddProfileUseCase {
  constructor(private readonly deps: AddProfileDeps) {}

  async execute({ accountId, input }: AddProfileInput): Promise<Result<SessionUser>> {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) return notFound('Conta não encontrada.');
    if (hasProfile(account, input.role)) return conflict(`Sua conta já tem um perfil de ${ROLE_LABEL[input.role]}.`);

    const cpf = await checkCpfForAccount(this.deps, account, input.cpf);
    if (!cpf.ok) return cpf;

    const profile = await this.deps.profiles.create(input.role, {
      email: account.email,
      name: input.name,
      phone: input.phone,
      cpf: input.cpf,
      bio: input.bio ?? null,
      certificates: input.certificates ?? null,
      courses: input.courses ?? null,
      experience: input.experience ?? null
    });
    if (!profile.ok) return profile;

    // TODO(db): na mesma transação que cria o perfil.
    account[profileKey(input.role)] = profile.value.id;
    account.last_role = input.role;
    await this.deps.accounts.update(account);
    return ok(toSession(account));
  }
}
