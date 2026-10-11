import type { Account } from '#modules/accounts';
import { createHmacSessionTokens, randomResetTokens } from '#shared/infra/crypto/node-crypto';
import { adjustableClock } from '#shared/testing/recorders';
import { createInMemoryRepositories } from '../../../infra/memory';
import type { AuthModuleDeps } from '../auth.module';

// Dependências do acesso em memória: hash de senha falso, tokens de verdade (HMAC e aleatórios)
// e relógio ajustável (para a validade da redefinição).

export const NOW = '2026-01-01T12:00:00.000Z';

export function authTestbed(): AuthModuleDeps & ReturnType<typeof createInMemoryRepositories> & { setNow: (iso: string) => void } {
  const clock = adjustableClock(NOW);
  return {
    ...createInMemoryRepositories(),
    clock,
    setNow: clock.set,
    passwords: { hash: (p) => Promise.resolve(`hash(${p})`), verify: (p, h) => Promise.resolve(h === `hash(${p})`) },
    resetTokens: randomResetTokens
  };
}

export const sessionTokens = (clock = adjustableClock(NOW)): ReturnType<typeof createHmacSessionTokens> => createHmacSessionTokens('segredo-de-teste', clock);

export function givenAccount(t: ReturnType<typeof authTestbed>, changes: Partial<Account> = {}): Promise<Account> {
  return t.accounts.create({
    email: 'ana@exemplo.com', password_hash: 'hash(senha-atual)', reset_token_digest: null, reset_expires_at: null,
    farmer_id: 1, worker_id: null, last_role: 'farmer', ...changes
  });
}
