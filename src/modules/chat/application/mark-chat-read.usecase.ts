import { type ChangeFeed, profileChats } from '#shared/domain/changes';
import { type Result, ok } from '#shared/domain/result';
import type { ChatMessageRepository, ChatRepository } from '../domain/chat.repository';
import type { ChatViewer } from '../domain/chat.rules';
import { messagesOf, readUpTo } from './chat-views';
import { findOwnChat } from './find-own-chat';

export interface MarkChatReadDeps {
  chats: ChatRepository;
  chatMessages: ChatMessageRepository;
  changes: ChangeFeed;
}

// Marca como lidas todas as mensagens da conversa para quem pediu (zera o contador dele).
export class MarkChatReadUseCase {
  constructor(private readonly deps: MarkChatReadDeps) {}

  async execute({ chatId, viewer }: { chatId: number; viewer: ChatViewer }): Promise<Result<null>> {
    const own = await findOwnChat(this.deps.chats, chatId, viewer);
    if (!own.ok) return own;
    const { chat, side } = own.value;

    const lastId = (await messagesOf(this.deps, chat.id)).at(-1)?.id ?? 0;
    if (lastId <= readUpTo(chat, side)) return ok(null);
    await this.deps.chats.update(side === 'farmer' ? { ...chat, farmer_read_up_to: lastId } : { ...chat, worker_read_up_to: lastId });
    this.deps.changes.publish([profileChats(side, side === 'farmer' ? chat.farmer_id : chat.worker_id)]);
    return ok(null);
  }
}
