import type { AccessPolicies } from '#modules/auth';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { ChatController } from './chat.controller';
import type { ChatSchemaName } from './chat.schemas';

const chatId = pathParam('id', 'ID da conversa.');
const chatOperation = operation<ChatSchemaName>;

const LIFECYCLE =
  'A conversa de um serviço abre quando o produtor aceita o trabalhador, fecha se ele desistir e continua aberta por 7 dias ' +
  'depois do pagamento. Os telefones (`phone`) só aparecem quando os dois liberaram o WhatsApp.';

function listEvents(role: string, listPath: string): string {
  return 'Server-Sent Events (`text/event-stream`), para usar com `EventSource`. A conexão fica aberta e `event: chats` ' +
    `(com \`data: {}\`) chega quando alguma conversa do ${role} muda (mensagem nova, lida, aberta, encerrada ou WhatsApp liberado); ` +
    `busque a lista de novo em \`${listPath}\`. A cada 25 s vai um comentário (\`: ping\`).`;
}

export interface ChatRoutes {
  // Em /api/farmers (antes de '/:id').
  farmer: readonly RouteDef[];
  // Em /api/workers (antes de '/:id').
  worker: readonly RouteDef[];
  // Em /api/chats.
  chats: readonly RouteDef[];
}

export function chatRoutes(chat: ChatController, access: AccessPolicies): ChatRoutes {
  return {
    farmer: [
      route('get', '/:id/chats', chat.farmerChats, chatOperation({
        tag: TAGS.chat,
        summary: 'Conversas do produtor',
        description: `A de mensagem mais recente primeiro, com o contador de não lidas. ${LIFECYCLE}`,
        params: [pathParam('id', 'ID do produtor.')],
        success: { status: 200, description: 'Conversas do produtor.', schema: { listOf: 'Chat' } }
      }), access.ownFarmer()),

      route('get', '/:id/chats/events', chat.farmerChatEvents, chatOperation({
        tag: TAGS.chat,
        summary: 'Acompanhar as conversas do produtor (SSE)',
        description: listEvents('produtor', 'GET /api/farmers/{id}/chats'),
        params: [pathParam('id', 'ID do produtor.')],
        success: { status: 200, description: 'Stream de eventos aberto.', eventStream: true }
      }), access.ownFarmer('id', { tokenInQuery: true }))
    ],
    worker: [
      route('get', '/:id/chats', chat.workerChats, chatOperation({
        tag: TAGS.chat,
        summary: 'Conversas do trabalhador',
        description: `A de mensagem mais recente primeiro, com o contador de não lidas. ${LIFECYCLE}`,
        params: [pathParam('id', 'ID do trabalhador.')],
        success: { status: 200, description: 'Conversas do trabalhador.', schema: { listOf: 'Chat' } }
      }), access.ownWorker()),

      route('get', '/:id/chats/events', chat.workerChatEvents, chatOperation({
        tag: TAGS.chat,
        summary: 'Acompanhar as conversas do trabalhador (SSE)',
        description: listEvents('trabalhador', 'GET /api/workers/{id}/chats'),
        params: [pathParam('id', 'ID do trabalhador.')],
        success: { status: 200, description: 'Stream de eventos aberto.', eventStream: true }
      }), access.ownWorker('id', { tokenInQuery: true }))
    ],
    chats: [
      route('get', '/:id', chat.getChat, chatOperation({
        tag: TAGS.chat,
        summary: 'Abrir conversa',
        description: `Todas as mensagens, da mais antiga para a mais nova. Abrir não marca como lida (use \`POST /:id/read\`). ${LIFECYCLE}`,
        params: [chatId],
        success: { status: 200, description: 'A conversa com as mensagens.', schema: 'ChatDetail' },
        errors: { 404: 'Conversa não encontrada.' }
      }), access.chatParticipant()),

      route('get', '/:id/events', chat.chatEvents, chatOperation({
        tag: TAGS.chat,
        summary: 'Acompanhar a conversa (SSE)',
        description:
          'Server-Sent Events (`text/event-stream`), para usar com `EventSource`. A conexão fica aberta e `event: chat` ' +
          '(com `data: {}`) chega a cada mensagem ou mudança no WhatsApp liberado; busque a conversa de novo em `GET /api/chats/{id}`. ' +
          'A cada 25 s vai um comentário (`: ping`).',
        params: [chatId],
        success: { status: 200, description: 'Stream de eventos aberto.', eventStream: true },
        errors: { 404: 'Conversa não encontrada.' }
      }), access.chatParticipant('id', { tokenInQuery: true })),

      route('post', '/:id/messages', chat.sendMessage, chatOperation({
        tag: TAGS.chat,
        summary: 'Enviar mensagem',
        description:
          'Até 1000 caracteres. Enquanto os dois não liberaram o WhatsApp, telefones e e-mails escritos no texto saem como ' +
          '`[número oculto]` e `[e-mail oculto]` (`masked: true`). A outra parte recebe uma notificação push.',
        params: [chatId],
        body: 'ChatMessageInput',
        success: { status: 201, description: 'Mensagem enviada.', schema: 'ChatMessageResponse' },
        errors: { 400: 'Mensagem vazia ou com mais de 1000 caracteres.', 404: 'Conversa não encontrada.', 409: 'A conversa foi encerrada.' }
      }), access.chatParticipant()),

      route('post', '/:id/read', chat.markRead, chatOperation({
        tag: TAGS.chat,
        summary: 'Marcar conversa como lida',
        params: [chatId],
        success: { status: 200, description: 'Contador de não lidas zerado para quem pediu.', schema: 'MessageResponse' },
        errors: { 404: 'Conversa não encontrada.' }
      }), access.chatParticipant()),

      route('patch', '/:id/phone', chat.sharePhone, chatOperation({
        tag: TAGS.chat,
        summary: 'Liberar o WhatsApp',
        description:
          '`share: true` libera o número de quem pede; `false` deixa de compartilhar. Os dois números só aparecem (`farmer.phone` e ' +
          '`worker.phone`) quando os dois liberaram. Cada mudança deixa um aviso na conversa.',
        params: [chatId],
        body: 'ChatPhoneInput',
        success: { status: 200, description: 'Conversa atualizada.', schema: 'ChatResponse' },
        errors: { 400: '`share` não é true/false.', 404: 'Conversa não encontrada.', 409: 'A conversa foi encerrada.' }
      }), access.chatParticipant())
    ]
  };
}
