import { type AccountRepository, findAccountByEmail } from '#modules/accounts';
import type { Clock } from '#shared/domain/clock';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { ResetTokens } from '#shared/domain/tokens';
import type { PasswordResetRequestInput } from '../auth.contract';
import { RESET_TOKEN_TTL_MS } from '../domain/reset-tokens';

export interface RequestPasswordResetDeps {
  accounts: AccountRepository;
  resetTokens: ResetTokens;
  clock: Clock;
}

// Passo 1 do "esqueci a senha": gera o token que iria por e-mail (um pedido novo invalida o anterior).
// Só o resumo do token fica guardado.
// TODO(email): enviar o código por e-mail, parar de devolvê-lo e responder 200 também para
// e-mail desconhecido (hoje o 404 revela quem tem cadastro).
export class RequestPasswordResetUseCase {
  constructor(private readonly deps: RequestPasswordResetDeps) {}

  async execute(input: PasswordResetRequestInput): Promise<Result<{ reset_token: string }>> {
    const account = await findAccountByEmail(this.deps.accounts, input.email);
    if (!account) return notFound('Não há conta com este e-mail.');

    const { token, digest } = this.deps.resetTokens.create();
    account.reset_token_digest = digest;
    account.reset_expires_at = new Date(Date.parse(this.deps.clock.now()) + RESET_TOKEN_TTL_MS).toISOString();
    await this.deps.accounts.update(account);
    return ok({ reset_token: token });
  }
}
