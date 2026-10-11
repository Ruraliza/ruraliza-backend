import type { ChangeFeed, ChangeListener } from '#shared/domain/changes';
import { chatMessages, profileChats } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type Result, ok } from '#shared/domain/result';
import type { ChatDetail } from '../chat.contract';
import type { ChatViewer } from '../domain/chat.rules';
import { type ChatViewDeps, toChatDetail } from './chat-views';
import { findOwnChat } from './find-own-chat';

export interface GetChatDeps extends ChatViewDeps {
  clock: Clock;
  changes: ChangeFeed;
}

// A conversa com todas as mensagens (abrir não marca como lida: a tela chama `read` quando mostra).
export class GetChatUseCase {
  constructor(private readonly deps: GetChatDeps) {}

  async execute({ chatId, viewer }: { chatId: number; viewer: ChatViewer }): Promise<Result<ChatDetail>> {
    const own = await findOwnChat(this.deps.chats, chatId, viewer);
    if (!own.ok) return own;
    return ok(await toChatDetail(this.deps, own.value.chat, own.value.side, this.deps.clock.now()));
  }

  // Acompanha as mensagens da conversa (tela aberta); devolve a função que para de acompanhar.
  async watch({ chatId, viewer, listener }: { chatId: number; viewer: ChatViewer; listener: ChangeListener }): Promise<Result<() => void>> {
    const own = await findOwnChat(this.deps.chats, chatId, viewer);
    if (!own.ok) return own;
    return ok(this.deps.changes.subscribe(chatMessages(own.value.chat.id), listener));
  }

  // Acompanha a lista de conversas de um perfil (tela "Conversas" e o contador do menu).
  watchList({ role, profileId, listener }: { role: 'farmer' | 'worker'; profileId: number; listener: ChangeListener }): () => void {
    return this.deps.changes.subscribe(profileChats(role, profileId), listener);
  }
}
