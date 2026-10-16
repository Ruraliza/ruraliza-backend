import { type RefTo, type Schema, id, input, isoDate, object, refTo } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI da central de notificações (contrato em ../notification.contract.ts). Registrados em src/docs/schemas.ts.
export type NotificationSchemaName = 'AppNotification' | 'NotificationsPage' | 'NotificationsReadInput' | 'NotificationsReadResponse';

const ref: RefTo<NotificationSchemaName> = refTo;
const unread: Schema = { type: 'integer', minimum: 0, example: 3, description: 'Avisos ainda não lidos (somando os agrupados).' };

export const notificationSchemas = {
  AppNotification: object(
    {
      id,
      title: { type: 'string', example: 'Nova candidatura' },
      body: { type: 'string', example: 'Maria se candidatou a Colheita de café.' },
      url: { type: 'string', example: 'produtor/servicos/3', description: 'Tela que o aviso abre, relativa ao app.' },
      count: { type: 'integer', minimum: 1, example: 2, description: 'Avisos iguais ainda não lidos agrupados neste.' },
      read: { type: 'boolean', example: false },
      insertion_date: isoDate
    },
    ['id', 'title', 'body', 'url', 'count', 'read', 'insertion_date'],
    'Aviso da central de notificações. Tudo o que vira push também fica aqui.'
  ),
  NotificationsPage: object(
    { unread, items: { type: 'array', items: ref('AppNotification') } },
    ['unread', 'items'],
    'Os 50 avisos mais recentes primeiro (cada perfil guarda até 100).'
  ),
  NotificationsReadInput: input(
    { ids: { type: 'array', items: { type: 'integer', minimum: 1 }, example: [12, 13] } },
    [],
    'Sem `ids`, marca todos os avisos do perfil como lidos.'
  ),
  NotificationsReadResponse: object(
    { message: { type: 'string', example: 'Notifications marked as read.' }, unread },
    ['message', 'unread']
  )
} satisfies Record<NotificationSchemaName, Schema>;
