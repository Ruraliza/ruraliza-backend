import { createInMemoryAccountRepository } from '#modules/accounts';
import type { Account } from '#modules/accounts';
import { fixedClock } from '#shared/testing/fixed-clock';
import type { PushDelivery, PushMessage, PushSubscriptionRecord } from '../domain/push';
import { createInMemoryPushSubscriptionRepository } from '../infra/in-memory-push-subscription.repository';
import type { NotificationsModuleDeps } from '../notifications.module';

// Dependências das notificações, em memória, com um PushSender que grava os envios e pode
// responder 'gone' (inscrição revogada) para endpoints escolhidos.

export const NOW = '2026-01-01T00:00:00.000Z';
export const KEYS = { p256dh: 'p', auth: 'a' };

export interface PushTestbed extends NotificationsModuleDeps {
  delivered: { endpoint: string; message: PushMessage }[];
  gone: Set<string>;
}

export function pushTestbed(): PushTestbed {
  const accounts = createInMemoryAccountRepository();
  const delivered: PushTestbed['delivered'] = [];
  const gone = new Set<string>();
  return {
    accounts,
    pushSubscriptions: createInMemoryPushSubscriptionRepository(),
    clock: fixedClock(NOW),
    sender: {
      send: (sub: PushSubscriptionRecord, message: PushMessage): Promise<PushDelivery> => {
        delivered.push({ endpoint: sub.endpoint, message });
        return Promise.resolve(gone.has(sub.endpoint) ? 'gone' : 'sent');
      }
    },
    delivered,
    gone
  };
}

let accountCount = 0;

export function givenAccount(t: PushTestbed, profiles: Partial<Pick<Account, 'farmer_id' | 'worker_id'>>): Promise<Account> {
  return t.accounts.create({
    email: `conta${++accountCount}@exemplo.com`, password_hash: 'x', reset_token_digest: null, reset_expires_at: null,
    farmer_id: profiles.farmer_id ?? null, worker_id: profiles.worker_id ?? null, last_role: profiles.farmer_id ? 'farmer' : 'worker'
  });
}

export function givenSubscription(t: PushTestbed, account: Account, endpoint: string): Promise<PushSubscriptionRecord> {
  return t.pushSubscriptions.create({ account_id: account.id, endpoint, ...KEYS, insertion_date: NOW });
}
