import type { Clock } from '#shared/domain/clock';
import type { Chat } from '../chat.contract';
import type { ChatRecord } from '../domain/chat.repository';
import type { ChatSide } from '../domain/chat.rules';
import { type ChatViewDeps, toChat } from './chat-views';

export interface ListChatsDeps extends ChatViewDeps {
  clock: Clock;
}

const lastActivity = (chat: Chat): string => chat.last_message?.insertion_date ?? chat.insertion_date;

// Conversas de um perfil, a de mensagem mais recente primeiro.
export class ListChatsUseCase {
  constructor(private readonly deps: ListChatsDeps) {}

  async forFarmer({ farmerId }: { farmerId: number }): Promise<Chat[]> {
    return this.list(await this.deps.chats.find({ farmer_id: farmerId }), 'farmer');
  }

  async forWorker({ workerId }: { workerId: number }): Promise<Chat[]> {
    return this.list(await this.deps.chats.find({ worker_id: workerId }), 'worker');
  }

  private async list(records: ChatRecord[], side: ChatSide): Promise<Chat[]> {
    const now = this.deps.clock.now();
    const chats = await Promise.all(records.map((chat) => toChat(this.deps, chat, side, now)));
    return chats.sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)) || b.id - a.id);
  }
}
