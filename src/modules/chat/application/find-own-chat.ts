import { type Result, forbidden, notFound, ok } from '#shared/domain/result';
import type { ChatRecord, ChatRepository } from '../domain/chat.repository';
import { type ChatSide, type ChatViewer, sideOf } from '../domain/chat.rules';

// A conversa e o lado de quem pediu. A rota já confere a participação (access.chatParticipant);
// aqui a regra é repetida para os casos de uso não dependerem disso.
export async function findOwnChat(chats: ChatRepository, chatId: number, viewer: ChatViewer): Promise<Result<{ chat: ChatRecord; side: ChatSide }>> {
  const chat = await chats.findById(chatId);
  if (!chat) return notFound('Conversa não encontrada.');
  const side = sideOf(chat, viewer);
  if (side === null) return forbidden('Esta conversa é de outras pessoas.');
  return ok({ chat, side });
}
