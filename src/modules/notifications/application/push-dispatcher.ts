import type { Account, AccountRepository, UserRole } from '#modules/accounts';
import { findAccountOf, preferencesOf } from '#modules/accounts';
import { appUrl } from '#shared/config';
import type { PhoneDirectory, PushMessage, PushNotifier, PushSender } from '../domain/push';
import type { PushSubscriptionRepository } from '../domain/push-subscription.repository';
import { type WhatsAppSender, whatsappNumber } from '../domain/whatsapp';
import { type NotificationHistoryDeps, recordNotification } from './notification-history';

export interface PushDispatcherDeps extends NotificationHistoryDeps {
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  sender: PushSender;
  whatsapp: WhatsAppSender;
  phoneOf: PhoneDirectory;
}

// Avisa um perfil em três frentes independentes, todas em segundo plano (`notify` não espera):
// 1. a central de notificações do perfil (histórico + sino, mesmo sem push ativado);
// 2. o push em todos os aparelhos inscritos na conta (inscrições revogadas, 'gone', são apagadas);
// 3. o WhatsApp, quando a mensagem traz o texto, a conta ligou "Avisos no WhatsApp" e há celular.
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
      account ? this.push(account, message) : Promise.resolve(),
      account && message.whatsapp ? this.whatsApp(account, role, profileId, message.whatsapp, message.url) : Promise.resolve()
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

  // A mensagem leva o link da tela do aviso (APP_URL + url).
  private async whatsApp(account: Account, role: UserRole, profileId: number, text: string, url: string): Promise<void> {
    const { whatsapp, phoneOf } = this.deps;
    if (!whatsapp.enabled || !preferencesOf(account).whatsapp_alerts) return;
    const phone = await phoneOf(role, profileId);
    const number = phone === null ? null : whatsappNumber(phone);
    if (number !== null) await whatsapp.send(number, `${text}
${appUrl()}/${url}`);
  }
}
