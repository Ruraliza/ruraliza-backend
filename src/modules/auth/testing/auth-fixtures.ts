import { createInMemoryAccountRepository } from '#modules/accounts';
import type { Account } from '#modules/accounts';
import { type ChatRepository, createInMemoryChatRepository } from '#modules/chat';
import { createInMemoryFarmerRepository } from '#modules/farmers';
import { type ServiceRepository, createInMemoryServiceRepository } from '#modules/services';
import { type SystemUserRepository, createInMemorySystemUserRepository } from '#modules/system-users';
import { createInMemoryWorkerRepository } from '#modules/workers';
import { createHmacSessionTokens, randomResetTokens } from '#shared/infra/crypto/node-crypto';
import { adjustableClock } from '#shared/testing/recorders';
import type { AuthModuleDeps } from '../auth.module';

// Dependências do acesso em memória: hash de senha falso, tokens de verdade (HMAC e aleatórios)
// e relógio ajustável (para a validade da redefinição).

export const NOW = '2026-01-01T12:00:00.000Z';

export interface AuthTestbed extends AuthModuleDeps {
  services: ServiceRepository;
  systemUsers: SystemUserRepository;
  chats: ChatRepository;
  setNow: (iso: string) => void;
  // Códigos de redefinição entregues (o que iria por e-mail).
  sentResetCodes: { email: string; code: string }[];
}

export function authTestbed(): AuthTestbed {
  const clock = adjustableClock(NOW);
  const sentResetCodes: AuthTestbed['sentResetCodes'] = [];
  return {
    sentResetCodes,
    deliverResetCode: (email, code) => { sentResetCodes.push({ email, code }); },
    accounts: createInMemoryAccountRepository(),
    farmers: createInMemoryFarmerRepository(),
    workers: createInMemoryWorkerRepository(),
    services: createInMemoryServiceRepository(),
    systemUsers: createInMemorySystemUserRepository(),
    chats: createInMemoryChatRepository(),
    clock,
    setNow: clock.set,
    passwords: { hash: (p) => Promise.resolve(`hash(${p})`), verify: (p, h) => Promise.resolve(h === `hash(${p})`) },
    resetTokens: randomResetTokens
  };
}

export const sessionTokens = (clock = adjustableClock(NOW)): ReturnType<typeof createHmacSessionTokens> => createHmacSessionTokens('segredo-de-teste', clock);

export function givenAccount(t: AuthTestbed, changes: Partial<Account> = {}): Promise<Account> {
  return t.accounts.create({
    email: 'ana@exemplo.com', password_hash: 'hash(senha-atual)', reset_token_digest: null, reset_expires_at: null,
    farmer_id: 1, worker_id: null, last_role: 'farmer', ...changes
  });
}
