import type { MessageResponse } from '#shared/contracts/api';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import { CHATS_CHANGED_EVENT, CHAT_CHANGED_EVENT, openEventStream, sendEvent } from '#shared/infra/http/sse';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { Chat, ChatDetail, ChatMessageResponse, ChatResponse } from '../chat.contract';
import type { ChatUseCases } from '../chat.module';
import { parseChatMessage, parseChatPhone, viewerOf } from './chat.parsers';

// HTTP das conversas: a lista de cada perfil (com avisos em tempo real), a conversa, enviar,
// marcar como lida e liberar o WhatsApp.
export interface ChatController {
  farmerChats: Handler<Chat[], IdParams>;
  farmerChatEvents: Handler<never, IdParams>;
  workerChats: Handler<Chat[], IdParams>;
  workerChatEvents: Handler<never, IdParams>;
  getChat: Handler<ChatDetail, IdParams>;
  chatEvents: Handler<never, IdParams>;
  sendMessage: Handler<ChatMessageResponse, IdParams>;
  markRead: Handler<MessageResponse, IdParams>;
  sharePhone: Handler<ChatResponse, IdParams>;
}

export function createChatController(chat: ChatUseCases): ChatController {
  // GET /api/farmers/:id/chats - Conversas do produtor
  const farmerChats: Handler<Chat[], IdParams> = async (req, res) => {
    res.status(200).json(await chat.listChats.forFarmer({ farmerId: toId(req.params.id) }));
  };

  // GET /api/farmers/:id/chats/events - Avisa quando alguma conversa do produtor muda
  const farmerChatEvents: Handler<never, IdParams> = (req, res) => {
    const stop = chat.getChat.watchList({ role: 'farmer', profileId: toId(req.params.id), listener: () => sendEvent(res, CHATS_CHANGED_EVENT) });
    openEventStream(res, stop);
  };

  // GET /api/workers/:id/chats - Conversas do trabalhador
  const workerChats: Handler<Chat[], IdParams> = async (req, res) => {
    res.status(200).json(await chat.listChats.forWorker({ workerId: toId(req.params.id) }));
  };

  // GET /api/workers/:id/chats/events - Avisa quando alguma conversa do trabalhador muda
  const workerChatEvents: Handler<never, IdParams> = (req, res) => {
    const stop = chat.getChat.watchList({ role: 'worker', profileId: toId(req.params.id), listener: () => sendEvent(res, CHATS_CHANGED_EVENT) });
    openEventStream(res, stop);
  };

  // GET /api/chats/:id - A conversa com as mensagens
  const getChat: Handler<ChatDetail, IdParams> = async (req, res) => {
    const result = await chat.getChat.execute({ chatId: toId(req.params.id), viewer: viewerOf(res.locals.principal) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // GET /api/chats/:id/events - Avisa quando chega mensagem na conversa
  const chatEvents: Handler<never, IdParams> = async (req, res) => {
    const listener = (): void => sendEvent(res, CHAT_CHANGED_EVENT);
    const result = await chat.getChat.watch({ chatId: toId(req.params.id), viewer: viewerOf(res.locals.principal), listener });
    if (!result.ok) { sendFailure(res, result); return; }
    openEventStream(res, result.value);
  };

  // POST /api/chats/:id/messages - Envia uma mensagem
  const sendMessage: Handler<ChatMessageResponse, IdParams> = async (req, res) => {
    const input = parseChatMessage(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await chat.sendMessage.execute({ chatId: toId(req.params.id), viewer: viewerOf(res.locals.principal), body: input.value.body });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Message sent.', ...result.value });
  };

  // POST /api/chats/:id/read - Marca a conversa como lida
  const markRead: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await chat.markChatRead.execute({ chatId: toId(req.params.id), viewer: viewerOf(res.locals.principal) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Chat marked as read.' });
  };

  // PATCH /api/chats/:id/phone - Libera (ou deixa de compartilhar) o próprio WhatsApp
  const sharePhone: Handler<ChatResponse, IdParams> = async (req, res) => {
    const input = parseChatPhone(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await chat.sharePhone.execute({ chatId: toId(req.params.id), viewer: viewerOf(res.locals.principal), share: input.value.share });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: input.value.share ? 'Phone shared.' : 'Phone hidden.', chat: result.value });
  };

  return { farmerChats, farmerChatEvents, workerChats, workerChatEvents, getChat, chatEvents, sendMessage, markRead, sharePhone };
}
