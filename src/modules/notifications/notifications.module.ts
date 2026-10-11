import type { AccountRepository } from '#modules/accounts';
import type { AccessPolicies } from '#modules/auth';
import type { Clock } from '#shared/domain/clock';
import { PushDispatcher } from './application/push-dispatcher';
import { SubscribePushUseCase } from './application/subscribe-push.usecase';
import { UnsubscribePushUseCase } from './application/unsubscribe-push.usecase';
import type { PushSender } from './domain/push';
import type { PushSubscriptionRepository } from './domain/push-subscription.repository';
import { createPushController } from './presentation/push.controller';
import { type PushRoutes, pushRoutes } from './presentation/push.routes';

export interface NotificationsModuleDeps {
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  clock: Clock;
  sender: PushSender;
}

export interface PushUseCases {
  subscribe: SubscribePushUseCase;
  unsubscribe: UnsubscribePushUseCase;
}

// Quem envia os pushes dos outros módulos (o PushNotifier que eles recebem).
export function createPushDispatcher(deps: NotificationsModuleDeps): PushDispatcher {
  return new PushDispatcher(deps);
}

// Casos de uso das inscrições (montados pelo container).
export function createPushUseCases(deps: NotificationsModuleDeps): PushUseCases {
  return { subscribe: new SubscribePushUseCase(deps), unsubscribe: new UnsubscribePushUseCase(deps) };
}

// Rotas HTTP (inscrições em /api/accounts, chave pública em /api).
export function createPushRoutes(useCases: PushUseCases, access: AccessPolicies): PushRoutes {
  return pushRoutes(createPushController(useCases), access);
}
