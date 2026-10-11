import { type AccountRepository, type SessionUser, findAccountByEmail, toSession } from '#modules/accounts';
import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, ok, unauthorized } from '#shared/domain/result';
import type { LoginInput } from '../auth.contract';

export interface LoginDeps {
  accounts: AccountRepository;
  passwords: PasswordHasher;
}

// Login do app: abre o último painel usado (ou o único perfil da conta). Mesma mensagem para
// e-mail desconhecido e senha errada: não revela quem tem cadastro.
export class LoginUseCase {
  constructor(private readonly deps: LoginDeps) {}

  async execute(input: LoginInput): Promise<Result<SessionUser>> {
    const account = await findAccountByEmail(this.deps.accounts, input.email);
    if (!account || !(await this.deps.passwords.verify(input.password, account.password_hash))) {
      return unauthorized('E-mail ou senha incorretos.');
    }
    return ok(toSession(account));
  }
}
