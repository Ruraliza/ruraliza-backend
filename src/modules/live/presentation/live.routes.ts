import type { AccessPolicies } from '#modules/auth';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { LiveController } from './live.controller';

const liveOperation = operation<never>;

function describe(events: string): string {
  return 'Server-Sent Events (`text/event-stream`), para usar com um `EventSource` só por aba. A conexão fica aberta e chega ' +
    `${events}, sempre com \`data: {}\`: busque de novo a lista correspondente. A cada 25 s vai um comentário (\`: ping\`). ` +
    'Substitui os streams separados de cada assunto (que continuam valendo): o navegador abre no máximo 6 conexões por servidor em HTTP/1.1.';
}

export interface LiveRoutes {
  farmer: readonly RouteDef[]; // em /api/farmers (antes de '/:id')
  worker: readonly RouteDef[]; // em /api/workers (antes de '/:id')
}

export function liveRoutes(live: LiveController, access: AccessPolicies): LiveRoutes {
  return {
    farmer: [
      route('get', '/:id/live', live.farmerLive, liveOperation({
        tag: TAGS.notifications,
        summary: 'Acompanhar o produtor (SSE)',
        description: describe('`event: chats` (alguma conversa mudou) e `event: notifications` (aviso novo ou lido)'),
        params: [pathParam('id', 'ID do produtor.')],
        success: { status: 200, description: 'Stream de eventos aberto.', eventStream: true }
      }), access.ownFarmer('id', { tokenInQuery: true }))
    ],
    worker: [
      route('get', '/:id/live', live.workerLive, liveOperation({
        tag: TAGS.notifications,
        summary: 'Acompanhar o trabalhador (SSE)',
        description: describe('`event: applications` (alguma candidatura mudou), `event: chats` e `event: notifications`'),
        params: [pathParam('id', 'ID do trabalhador.')],
        success: { status: 200, description: 'Stream de eventos aberto.', eventStream: true }
      }), access.ownWorker('id', { tokenInQuery: true }))
    ]
  };
}
