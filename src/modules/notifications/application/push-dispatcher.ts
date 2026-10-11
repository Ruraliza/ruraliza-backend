import type { AccountRepository, UserRole } from '#modules/accounts';
import { findAccountOf } from '#modules/accounts';
import type { PushMessage, PushNotifier, PushSender } from '#modules/notifications';
import type { PushSubscriptionRepository } from '../domain/push-subscription.repository';

export interface PushDispatcherDeps {
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  sender: PushSender;
}

// Envia o push a todos os aparelhos inscritos na conta do perfil avisado. Roda em segundo plano
// (`notify` não espera): a operação que avisou já respondeu, e uma falha do serviço de push só vai
// para o log. Inscrições que o navegador revogou ('gone') são apagadas no primeiro envio.
export class PushDispatcher implements PushNotifier {
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly deps: PushDispatcherDeps) {}

  notify(role: UserRole, profileId: number, message: PushMessage): void {
    const delivery = this.deliver(role, profileId, message)
      .catch((error: unknown) => console.error('Falha ao enviar notificação push:', error))
      .finally(() => this.pending.delete(delivery));
    this.pending.add(delivery);
  }

  // Espera os envios em andamento (para os testes).
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all(this.pending);
  }

  private async deliver(role: UserRole, profileId: number, message: PushMessage): Promise<void> {
    const { accounts, pushSubscriptions, sender } = this.deps;
    const account = await findAccountOf(accounts, role, profileId);
    if (!account) return;

    const subscriptions = await pushSubscriptions.find({ account_id: account.id });
    await Promise.all(
      subscriptions.map(async (sub) => {
        if ((await sender.send(sub, message)) === 'gone') await pushSubscriptions.delete(sub.id);
      })
    );
  }
}
