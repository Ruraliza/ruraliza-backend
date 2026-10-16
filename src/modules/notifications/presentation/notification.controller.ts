import type { UserRole } from '#modules/accounts';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import { NOTIFICATIONS_CHANGED_EVENT, openEventStream, sendEvent } from '#shared/infra/http/sse';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { NotificationsPage, NotificationsReadResponse } from '../notification.contract';
import type { NotificationUseCases } from '../notifications.module';
import { parseNotificationsRead } from './notification.parsers';

// Os três handlers de um perfil (o nome de cada um vira o operationId da documentação).
export interface ProfileNotificationHandlers {
  list: Handler<NotificationsPage, IdParams>;
  markRead: Handler<NotificationsReadResponse, IdParams>;
  events: Handler<never, IdParams>;
}

// HTTP da central de notificações, igual para produtor e trabalhador.
export interface NotificationController {
  farmer: ProfileNotificationHandlers;
  worker: ProfileNotificationHandlers;
}

type Req = Parameters<Handler<never, IdParams>>[0];
type Res<T> = Parameters<Handler<T, IdParams>>[1];

export function createNotificationController(useCases: NotificationUseCases): NotificationController {
  async function list(role: UserRole, req: Req, res: Res<NotificationsPage>): Promise<void> {
    res.status(200).json(await useCases.list.execute({ role, profileId: toId(req.params.id) }));
  }

  async function markRead(role: UserRole, req: Req, res: Res<NotificationsReadResponse>): Promise<void> {
    const input = parseNotificationsRead(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const unread = await useCases.markRead.execute({ role, profileId: toId(req.params.id), ...input.value });
    res.status(200).json({ message: 'Notifications marked as read.', unread });
  }

  function events(role: UserRole, req: Req, res: Res<never>): void {
    const stop = useCases.list.watch({ role, profileId: toId(req.params.id), listener: () => sendEvent(res, NOTIFICATIONS_CHANGED_EVENT) });
    openEventStream(res, stop);
  }

  // GET /api/farmers/:id/notifications - Avisos do produtor, os mais recentes primeiro
  const farmerNotifications: Handler<NotificationsPage, IdParams> = (req, res) => list('farmer', req, res);
  // POST /api/farmers/:id/notifications/read - Marca avisos do produtor como lidos (todos, sem `ids`)
  const farmerNotificationsRead: Handler<NotificationsReadResponse, IdParams> = (req, res) => markRead('farmer', req, res);
  // GET /api/farmers/:id/notifications/events - Avisa o sino do produtor quando chega aviso novo
  const farmerNotificationEvents: Handler<never, IdParams> = (req, res) => events('farmer', req, res);
  // GET /api/workers/:id/notifications - Avisos do trabalhador
  const workerNotifications: Handler<NotificationsPage, IdParams> = (req, res) => list('worker', req, res);
  // POST /api/workers/:id/notifications/read - Marca avisos do trabalhador como lidos
  const workerNotificationsRead: Handler<NotificationsReadResponse, IdParams> = (req, res) => markRead('worker', req, res);
  // GET /api/workers/:id/notifications/events - Avisa o sino do trabalhador
  const workerNotificationEvents: Handler<never, IdParams> = (req, res) => events('worker', req, res);

  return {
    farmer: { list: farmerNotifications, markRead: farmerNotificationsRead, events: farmerNotificationEvents },
    worker: { list: workerNotifications, markRead: workerNotificationsRead, events: workerNotificationEvents }
  };
}
