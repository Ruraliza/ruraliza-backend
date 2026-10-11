import type { Account, AccountRepository } from '#modules/accounts';
import { ROLE_LABEL, findAccountByEmail, findAccountOf, toSession } from '#modules/accounts';
import type { Clock } from '#shared/domain/clock';
import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, invalid, notFound, ok, requireFound, unauthorized } from '#shared/domain/result';
import type { LoginInput, PasswordChangeInput, PasswordResetInput, PasswordResetRequestInput, SessionUser, UserRole } from '../contracts';
import { RESET_TOKEN_TTL_MS, type ResetTokens } from '../domain/passwords';
import type { FarmerRepository, WorkerRepository } from '../domain/repositories';

// Mesma mensagem para e-mail desconhecido e senha errada: não revela quem tem cadastro.
const WRONG_CREDENTIALS = 'E-mail ou senha incorretos.';
const INVALID_RESET = 'Este pedido de redefinição é inválido ou expirou. Peça uma nova redefinição de senha.';

export interface PasswordTools {
  hasher: PasswordHasher;
  resetTokens: ResetTokens;
}

// Login, "esqueci a senha" e troca de senha com a conta aberta.
// A senha é da conta (ver src/domain/passwords.ts) e vale para os dois perfis.
export class AuthUseCases {
  constructor(
    private readonly repos: { farmers: FarmerRepository; workers: WorkerRepository; accounts: AccountRepository },
    private readonly clock: Clock,
    private readonly tools: PasswordTools
  ) {}

  // Abre o último painel usado (ou o único perfil da conta).
  async login(input: LoginInput): Promise<Result<SessionUser>> {
    const account = await findAccountByEmail(this.repos.accounts, input.email);
    if (!account || !(await this.tools.hasher.verify(input.password, account.password_hash))) {
      return unauthorized(WRONG_CREDENTIALS);
    }
    return ok(toSession(account));
  }

  // Passo 1 do "esqueci a senha": gera o token que iria por e-mail (um pedido novo invalida o anterior).
  // TODO(email): enviar o código por e-mail, parar de devolvê-lo e responder 200 também para
  // e-mail desconhecido (hoje o 404 revela quem tem cadastro).
  async requestReset(input: PasswordResetRequestInput): Promise<Result<{ reset_token: string }>> {
    const account = await findAccountByEmail(this.repos.accounts, input.email);
    if (!account) return notFound('Não há conta com este e-mail.');

    const { token, digest } = this.tools.resetTokens.create();
    account.reset_token_digest = digest;
    account.reset_expires_at = new Date(Date.parse(this.clock.now()) + RESET_TOKEN_TTL_MS).toISOString();
    await this.repos.accounts.update(account);
    return ok({ reset_token: token });
  }

  // Passo 2: cria a nova senha. O token vale uma vez só.
  async resetPassword(input: PasswordResetInput): Promise<Result<SessionUser>> {
    const [account] = await this.repos.accounts.find({ reset_token_digest: this.tools.resetTokens.digest(input.token) });
    const expired = account?.reset_expires_at == null || Date.parse(account.reset_expires_at) <= Date.parse(this.clock.now());
    if (!account || expired) return invalid(INVALID_RESET);

    await this.savePassword(account, input.password);
    return ok(toSession(account));
  }

  // Com a conta aberta: confirma a senha atual em vez de mandar código por e-mail.
  async changePassword(role: UserRole, userId: number, input: PasswordChangeInput): Promise<Result<null>> {
    const profiles = role === 'farmer' ? this.repos.farmers : this.repos.workers;
    if (!(await profiles.findById(userId))) return notFound(role === 'farmer' ? 'Produtor não encontrado.' : 'Trabalhador não encontrado.');

    const account = requireFound(await findAccountOf(this.repos.accounts, role, userId), `conta do ${ROLE_LABEL[role]} ${userId}`);
    if (!(await this.tools.hasher.verify(input.current_password, account.password_hash))) {
      return unauthorized('A senha atual está incorreta.');
    }
    if (input.current_password === input.new_password) return invalid('A nova senha precisa ser diferente da atual.');

    await this.savePassword(account, input.new_password);
    return ok(null);
  }

  // Trocar a senha também cancela uma redefinição pendente.
  private async savePassword(account: Account, password: string): Promise<void> {
    account.password_hash = await this.tools.hasher.hash(password);
    account.reset_token_digest = null;
    account.reset_expires_at = null;
    await this.repos.accounts.update(account);
  }
}
