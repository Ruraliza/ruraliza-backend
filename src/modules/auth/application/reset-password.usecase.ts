import { type AccountRepository, type SessionUser, toSession } from '#modules/accounts';
import type { Clock } from '#shared/domain/clock';
import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, invalid, ok } from '#shared/domain/result';
import type { ResetTokens } from '#shared/domain/tokens';
import type { PasswordResetInput } from '../auth.contract';
import { savePassword } from './save-password';

export interface ResetPasswordDeps {
  accounts: AccountRepository;
  passwords: PasswordHasher;
  resetTokens: ResetTokens;
  clock: Clock;
}

// Passo 2: cria a nova senha e abre a sessão. O token vale uma vez só, até expirar.
export class ResetPasswordUseCase {
  constructor(private readonly deps: ResetPasswordDeps) {}

  async execute(input: PasswordResetInput): Promise<Result<SessionUser>> {
    const [account] = await this.deps.accounts.find({ reset_token_digest: this.deps.resetTokens.digest(input.token) });
    const expired = account?.reset_expires_at == null || Date.parse(account.reset_expires_at) <= Date.parse(this.deps.clock.now());
    if (!account || expired) return invalid('Este pedido de redefinição é inválido ou expirou. Peça uma nova redefinição de senha.');

    await savePassword(this.deps, account, input.password);
    return ok(toSession(account));
  }
}
