import type { SessionTokens } from '#shared/domain/tokens';
import type { SessionUser } from '../accounts.contract';

// Token de sessão da conta (login, cadastro e redefinição de senha devolvem um).
export function accountToken(tokens: SessionTokens, user: SessionUser): string {
  return tokens.issue({ kind: 'account', id: user.account_id });
}
