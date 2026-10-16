import type { AccountRepository, UserRole } from '#modules/accounts';
import type { AccessPolicies } from '#modules/auth';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { ListNotificationsUseCase } from './application/list-notifications.usecase';
import { MarkNotificationsReadUseCase } from './application/mark-notifications-read.usecase';
import { removeNotificationsOf } from './application/notification-history';
import { PushDispatcher } from './application/push-dispatcher';
import { SubscribePushUseCase } from './application/subscribe-push.usecase';
import { UnsubscribePushUseCase } from './application/unsubscribe-push.usecase';
import type { NotificationRepository } from './domain/notification';
import type { PhoneDirectory, PushSender } from './domain/push';
import type { PushSubscriptionRepository } from './domain/push-subscription.repository';
import type { WhatsAppSender } from './domain/whatsapp';
import { createNotificationController } from './presentation/notification.controller';
import { type NotificationRoutes, notificationRoutes } from './presentation/notification.routes';
import { createPushController } from './presentation/push.controller';
import { type PushRoutes, pushRoutes } from './presentation/push.routes';

export interface NotificationsModuleDeps {
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  notifications: NotificationRepository;
  changes: ChangeFeed;
  clock: Clock;
  sender: PushSender;
  whatsapp: WhatsAppSender;
  phoneOf: PhoneDirectory;
}

export interface PushUseCases {
  subscribe: SubscribePushUseCase;
  unsubscribe: UnsubscribePushUseCase;
  // Se a integração de WhatsApp está ligada (o app só oferece a opção quando está).
  whatsappEnabled(): boolean;
}

export interface NotificationUseCases {
  list: ListNotificationsUseCase;
  markRead: MarkNotificationsReadUseCase;
  // Perfil removido: apaga o histórico dele.
  removeFor(role: UserRole, profileId: number): Promise<void>;
}

// Quem avisa os perfis em nome dos outros módulos (o PushNotifier que eles recebem):
// central de notificações, push e WhatsApp.
export function createPushDispatcher(deps: NotificationsModuleDeps): PushDispatcher {
  return new PushDispatcher(deps);
}

// Casos de uso das inscrições de push (montados pelo container).
export function createPushUseCases(deps: NotificationsModuleDeps): PushUseCases {
  return { subscribe: new SubscribePushUseCase(deps), unsubscribe: new UnsubscribePushUseCase(deps), whatsappEnabled: () => deps.whatsapp.enabled };
}

// Casos de uso da central de notificações (montados pelo container).
export function createNotificationUseCases(deps: Pick<NotificationsModuleDeps, 'notifications' | 'changes'>): NotificationUseCases {
  return {
    list: new ListNotificationsUseCase(deps),
    markRead: new MarkNotificationsReadUseCase(deps),
    removeFor: (role, profileId) => removeNotificationsOf(deps.notifications, role, profileId)
  };
}

// Rotas HTTP (inscrições em /api/accounts, chave pública em /api).
export function createPushRoutes(useCases: PushUseCases, access: AccessPolicies): PushRoutes {
  return pushRoutes(createPushController(useCases), access);
}

// Rotas da central de notificações (em /api/farmers e /api/workers).
export function createNotificationRoutes(useCases: NotificationUseCases, access: AccessPolicies): NotificationRoutes {
  return notificationRoutes(createNotificationController(useCases), access);
}
