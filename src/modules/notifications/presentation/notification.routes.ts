import type { AccessPolicies } from '#modules/auth';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { NotificationController, ProfileNotificationHandlers } from './notification.controller';
import type { NotificationSchemaName } from './notification.schemas';

const notificationOperation = operation<NotificationSchemaName>;

export interface NotificationRoutes {
  farmer: readonly RouteDef[]; // em /api/farmers
  worker: readonly RouteDef[]; // em /api/workers
}

type OwnProfile = AccessPolicies['ownFarmer'];

function profileRoutes(controller: ProfileNotificationHandlers, who: 'produtor' | 'trabalhador', own: OwnProfile): RouteDef[] {
  const profileId = pathParam('id', `ID do ${who}.`);
  return [
    route('get', '/:id/notifications', controller.list, notificationOperation({
      tag: TAGS.notifications,
      summary: `Central de notificações do ${who}`,
      description:
        'Histórico dos avisos do perfil (candidaturas, aceites, pagamentos, mensagens, avaliações), os mais recentes primeiro. ' +
        'Tudo o que vira push também fica aqui, mesmo sem push ativado. Avisos iguais ainda não lidos são agrupados (`count`).',
      params: [profileId],
      success: { status: 200, description: 'Avisos e quantos faltam ler.', schema: 'NotificationsPage' }
    }), own()),

    route('post', '/:id/notifications/read', controller.markRead, notificationOperation({
      tag: TAGS.notifications,
      summary: 'Marcar avisos como lidos',
      description: 'Sem `ids`, marca todos. Ids de outro perfil são ignorados.',
      params: [profileId],
      body: 'NotificationsReadInput',
      success: { status: 200, description: 'Avisos marcados; `unread` é quantos faltam.', schema: 'NotificationsReadResponse' },
      errors: { 400: '`ids` não é uma lista de inteiros positivos.' }
    }), own()),

    route('get', '/:id/notifications/events', controller.events, notificationOperation({
      tag: TAGS.notifications,
      summary: `Acompanhar os avisos do ${who} (SSE)`,
      description:
        '`text/event-stream` com `event: notifications` quando chega aviso novo ou algum é lido; a tela busca a lista de novo. ' +
        'O token também vale em `?access_token=` (o EventSource não manda cabeçalhos).',
      params: [profileId],
      success: { status: 200, description: 'Stream de eventos aberto.', eventStream: true }
    }), own('id', { tokenInQuery: true }))
  ];
}

export function notificationRoutes(controller: NotificationController, access: AccessPolicies): NotificationRoutes {
  return {
    farmer: profileRoutes(controller.farmer, 'produtor', (param, options) => access.ownFarmer(param, options)),
    worker: profileRoutes(controller.worker, 'trabalhador', (param, options) => access.ownWorker(param, options))
  };
}
