import { type AccountRepository, findAccountByEmail } from '#modules/accounts';
import type { Clock } from '#shared/domain/clock';
import type { ResetTokens } from '#shared/domain/tokens';
import type { PasswordResetRequestInput } from '../auth.contract';
import { RESET_TOKEN_TTL_MS, type ResetCodeDelivery } from '../domain/reset-tokens';

export interface RequestPasswordResetDeps {
  accounts: AccountRepository;
  resetTokens: ResetTokens;
  clock: Clock;
  deliverResetCode: ResetCodeDelivery | null;
}

// Passo 1 do "esqueci a senha": gera o código e o entrega ao dono do e-mail (um pedido novo invalida o anterior).
// Só o resumo do código fica guardado. O resultado é o mesmo com e sem conta, para não revelar quem tem cadastro.
// TODO(email): enquanto o envio por e-mail não existe, não há entrega (null) e nada é criado.
export class RequestPasswordResetUseCase {
  constructor(private readonly deps: RequestPasswordResetDeps) {}

  async execute(input: PasswordResetRequestInput): Promise<void> {
    const { deliverResetCode } = this.deps;
    if (!deliverResetCode) return;
    const account = await findAccountByEmail(this.deps.accounts, input.email);
    if (!account) return;

    const { token, digest } = this.deps.resetTokens.create();
    account.reset_token_digest = digest;
    account.reset_expires_at = new Date(Date.parse(this.deps.clock.now()) + RESET_TOKEN_TTL_MS).toISOString();
    await this.deps.accounts.update(account);
    deliverResetCode(account.email, token);
  }
}
