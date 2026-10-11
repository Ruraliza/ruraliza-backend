import { type AccountRepository, ROLE_LABEL, type UserRole, findAccountOf } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { WorkerRepository } from '#modules/workers';
import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, invalid, notFound, ok, requireFound, unauthorized } from '#shared/domain/result';
import type { PasswordChangeInput } from '../auth.contract';
import { savePassword } from './save-password';

export interface ChangePasswordDeps {
  accounts: AccountRepository;
  farmers: FarmerRepository;
  workers: WorkerRepository;
  passwords: PasswordHasher;
}

export interface ChangePasswordInput {
  role: UserRole;
  profileId: number;
  input: PasswordChangeInput;
}

// Com a conta aberta: confirma a senha atual em vez de mandar código por e-mail. A senha é da
// conta, então vale para os dois perfis.
export class ChangePasswordUseCase {
  constructor(private readonly deps: ChangePasswordDeps) {}

  async execute({ role, profileId, input }: ChangePasswordInput): Promise<Result<null>> {
    const profiles = role === 'farmer' ? this.deps.farmers : this.deps.workers;
    if (!(await profiles.findById(profileId))) return notFound(role === 'farmer' ? 'Produtor não encontrado.' : 'Trabalhador não encontrado.');

    const account = requireFound(await findAccountOf(this.deps.accounts, role, profileId), `conta do ${ROLE_LABEL[role]} ${profileId}`);
    if (!(await this.deps.passwords.verify(input.current_password, account.password_hash))) {
      return unauthorized('A senha atual está incorreta.');
    }
    if (input.current_password === input.new_password) return invalid('A nova senha precisa ser diferente da atual.');

    await savePassword(this.deps, account, input.new_password);
    return ok(null);
  }
}
