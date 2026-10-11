import type { Clock } from '#shared/domain/clock';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { AccountRepository } from '../../../domain/repositories';
import type { PushSubscriptionInput } from '../push.contract';
import type { PushSubscriptionRepository } from '../domain/push-subscription.repository';

export interface SubscribePushDeps {
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  clock: Clock;
}

export interface SubscribePushInput {
  accountId: number;
  input: PushSubscriptionInput;
}

// Inscrição nova ou repetida (o frontend reenvia a cada abertura): o endpoint identifica o aparelho.
// Se o aparelho era de outra conta (outra pessoa entrou nele), passa para esta.
export class SubscribePushUseCase {
  constructor(private readonly deps: SubscribePushDeps) {}

  async execute({ accountId, input }: SubscribePushInput): Promise<Result<null>> {
    const { accounts, pushSubscriptions } = this.deps;
    if (!(await accounts.findById(accountId))) return notFound('Conta não encontrada.');

    const data = { account_id: accountId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth };
    const [existing] = await pushSubscriptions.find({ endpoint: input.endpoint });
    if (existing) await pushSubscriptions.update({ ...existing, ...data });
    else await pushSubscriptions.create({ ...data, insertion_date: this.deps.clock.now() });
    return ok(null);
  }
}
