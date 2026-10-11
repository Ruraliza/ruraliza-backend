// API pública do módulo de notificações push: o único arquivo que outros módulos enxergam (#modules/notifications).
export type * from './push.contract';
export type { PushDispatcher } from './application/push-dispatcher';
export {
  type PushDelivery,
  type PushMessage,
  type PushNotifier,
  type PushSender,
  type PushSubscriptionRecord,
  WORKER_APPLICATIONS_URL,
  farmerServiceUrl
} from './domain/push';
export type { PushSubscriptionRepository } from './domain/push-subscription.repository';
export { createInMemoryPushSubscriptionRepository } from './infra/in-memory-push-subscription.repository';
export { WebPushSender, toAngularPayload } from './infra/web-push-sender';
export type { PushRoutes } from './presentation/push.routes';
export { type PushSchemaName, pushSchemas } from './presentation/push.schemas';
export {
  type NotificationsModuleDeps,
  type PushUseCases,
  createPushDispatcher,
  createPushRoutes,
  createPushUseCases
} from './notifications.module';
