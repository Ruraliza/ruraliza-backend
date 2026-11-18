import type { Account, AccountRepository, UserRole } from '#modules/accounts';
import { findAccountOf } from '#modules/accounts';
import type { PushMessage, PushNotifier, PushSender } from '../domain/push';
import type { PushSubscriptionRepository } from '../domain/push-subscription.repository';
import { type NotificationHistoryDeps, recordNotification } from './notification-history';

export interface PushDispatcherDeps extends NotificationHistoryDeps {
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  sender: PushSender;
}

// Avisa um perfil em duas frentes independentes, as duas em segundo plano (`notify` não espera):
// 1. a central de notificações do perfil (histórico + sino, mesmo sem push ativado);
// 2. o push em todos os aparelhos inscritos na conta (inscrições revogadas, 'gone', são apagadas).
// A operação que avisou já respondeu; uma falha em qualquer frente só vai para o log.
export class PushDispatcher implements PushNotifier {
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly deps: PushDispatcherDeps) {}

  notify(role: UserRole, profileId: number, message: PushMessage): void {
    const delivery = this.deliver(role, profileId, message).finally(() => this.pending.delete(delivery));
    this.pending.add(delivery);
  }

  // Espera os envios em andamento (para os testes).
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all(this.pending);
  }

  private async deliver(role: UserRole, profileId: number, message: PushMessage): Promise<void> {
    const account = await findAccountOf(this.deps.accounts, role, profileId).catch(() => undefined);
    const results = await Promise.allSettled([
      recordNotification(this.deps, role, profileId, message),
      account ? this.push(account, message) : Promise.resolve()
    ]);
    for (const result of results) {
      if (result.status === 'rejected') console.error('Falha ao entregar notificação:', result.reason);
    }
  }

  private async push(account: Account, message: PushMessage): Promise<void> {
    const { pushSubscriptions, sender } = this.deps;
    const { title, body, url } = message;
    const subscriptions = await pushSubscriptions.find({ account_id: account.id });
    await Promise.all(
      subscriptions.map(async (sub) => {
        if ((await sender.send(sub, { title, body, url })) === 'gone') await pushSubscriptions.delete(sub.id);
      })
    );
  }

}
