import { type Result, notFound, ok } from '#shared/domain/result';
import type { AccountRepository } from '../../../domain/repositories';
import type { PushSubscriptionRepository } from '../domain/push-subscription.repository';

export interface UnsubscribePushDeps {
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
}

export interface UnsubscribePushInput {
  accountId: number;
  endpoint: string;
}

// Remover uma inscrição que não existe (ou já saiu) não é erro: o resultado é o mesmo.
export class UnsubscribePushUseCase {
  constructor(private readonly deps: UnsubscribePushDeps) {}

  async execute({ accountId, endpoint }: UnsubscribePushInput): Promise<Result<null>> {
    const { accounts, pushSubscriptions } = this.deps;
    if (!(await accounts.findById(accountId))) return notFound('Conta não encontrada.');

    for (const sub of await pushSubscriptions.find({ account_id: accountId, endpoint })) {
      await pushSubscriptions.delete(sub.id);
    }
    return ok(null);
  }
}
