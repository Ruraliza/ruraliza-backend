import type { PushSubscriptionInput, UserRole } from '../contracts';
import type { Clock } from '../domain/clock';
import type { PushMessage, PushNotifier, PushSender } from '../domain/push';
import type { AccountRepository, PushSubscriptionRepository } from '../domain/repositories';
import { type Result, notFound, ok } from '../domain/result';
import { findAccountOf } from './accounts';

const ACCOUNT_NOT_FOUND = 'Conta não encontrada.';

// Notificações push: inscrições por conta (um registro por navegador/aparelho) e o envio
// quando algo muda nas candidaturas. O envio roda em segundo plano (`notify` não espera):
// a operação que avisou já respondeu, e uma falha do serviço de push só vai para o log.
export class PushUseCases implements PushNotifier {
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly repos: { accounts: AccountRepository; pushSubscriptions: PushSubscriptionRepository },
    private readonly clock: Clock,
    private readonly sender: PushSender
  ) {}

  // Inscrição nova ou repetida (o frontend reenvia a cada abertura): o endpoint identifica o aparelho.
  // Se o aparelho era de outra conta (outra pessoa entrou nele), passa para esta.
  async subscribe(accountId: number, input: PushSubscriptionInput): Promise<Result<null>> {
    const { accounts, pushSubscriptions } = this.repos;
    if (!(await accounts.findById(accountId))) return notFound(ACCOUNT_NOT_FOUND);

    const data = { account_id: accountId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth };
    const [existing] = await pushSubscriptions.find({ endpoint: input.endpoint });
    if (existing) await pushSubscriptions.update({ ...existing, ...data });
    else await pushSubscriptions.create({ ...data, insertion_date: this.clock.now() });
    return ok(null);
  }

  // Remover uma inscrição que não existe (ou já saiu) não é erro: o resultado é o mesmo.
  async unsubscribe(accountId: number, endpoint: string): Promise<Result<null>> {
    const { accounts, pushSubscriptions } = this.repos;
    if (!(await accounts.findById(accountId))) return notFound(ACCOUNT_NOT_FOUND);

    for (const sub of await pushSubscriptions.find({ account_id: accountId, endpoint })) {
      await pushSubscriptions.delete(sub.id);
    }
    return ok(null);
  }

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
    const { accounts, pushSubscriptions } = this.repos;
    const account = await findAccountOf(accounts, role, profileId);
    if (!account) return;

    const subscriptions = await pushSubscriptions.find({ account_id: account.id });
    await Promise.all(
      subscriptions.map(async (sub) => {
        if ((await this.sender.send(sub, message)) === 'gone') await pushSubscriptions.delete(sub.id);
      })
    );
  }
}
