// API pública do módulo de notificações (push, central de notificações e WhatsApp):
// o único arquivo que outros módulos enxergam (#modules/notifications).
export type * from './push.contract';
export type * from './notification.contract';
export type { PushDispatcher } from './application/push-dispatcher';
export {
  type PhoneDirectory,
  type PushDelivery,
  type PushMessage,
  type PushNotifier,
  type PushSender,
  type PushSubscriptionRecord,
  WORKER_APPLICATIONS_URL,
  chatUrl,
  farmerServiceUrl,
  helpUrl,
  workerJobUrl
} from './domain/push';
export type { NotificationRecord, NotificationRepository } from './domain/notification';
export { DISABLED_WHATSAPP, type WhatsAppSender, whatsappNumber } from './domain/whatsapp';
export type { PushSubscriptionRepository } from './domain/push-subscription.repository';
export { createInMemoryPushSubscriptionRepository } from './infra/in-memory-push-subscription.repository';
export { createInMemoryNotificationRepository } from './infra/in-memory-notification.repository';
export { EvolutionWhatsAppSender } from './infra/evolution-whatsapp-sender';
export { WebPushSender, toAngularPayload } from './infra/web-push-sender';
export type { PushRoutes } from './presentation/push.routes';
export type { NotificationRoutes } from './presentation/notification.routes';
export { type PushSchemaName, pushSchemas } from './presentation/push.schemas';
export { type NotificationSchemaName, notificationSchemas } from './presentation/notification.schemas';
export {
  type NotificationUseCases,
  type NotificationsModuleDeps,
  type PushUseCases,
  createNotificationRoutes,
  createNotificationUseCases,
  createPushDispatcher,
  createPushRoutes,
  createPushUseCases
} from './notifications.module';
