import type { FarmerRepository } from '#modules/farmers';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import { type ChangeFeed, chatMessages, profileChats } from '#shared/domain/changes';
import { requireFound } from '#shared/domain/result';
import type { Chat, ChatDetail, ChatMessage } from '../chat.contract';
import type { ChatMessageRepository, ChatRecord, ChatRepository } from '../domain/chat.repository';
import { type ChatSide, bothSharePhone, isOpen } from '../domain/chat.rules';

export interface ChatViewDeps {
  chats: ChatRepository;
  chatMessages: ChatMessageRepository;
  services: ServiceRepository;
  farmers: FarmerRepository;
  workers: WorkerRepository;
}

export async function messagesOf(deps: Pick<ChatViewDeps, 'chatMessages'>, chatId: number): Promise<ChatMessage[]> {
  return (await deps.chatMessages.find({ chat_id: chatId })).sort((a, b) => a.id - b.id);
}

export function readUpTo(chat: ChatRecord, side: ChatSide): number {
  return side === 'farmer' ? chat.farmer_read_up_to : chat.worker_read_up_to;
}

// A conversa como `side` a vê: o contador de não lidas é dele, e os telefones só aparecem
// quando os dois liberaram o WhatsApp.
export async function toChat(deps: ChatViewDeps, chat: ChatRecord, side: ChatSide, now: string, messages?: ChatMessage[]): Promise<Chat> {
  const all = messages ?? (await messagesOf(deps, chat.id));
  const service = requireFound(await deps.services.findById(chat.service_id), `serviço da conversa ${chat.id}`);
  const farmer = requireFound(await deps.farmers.findById(chat.farmer_id), `produtor da conversa ${chat.id}`);
  const worker = requireFound(await deps.workers.findById(chat.worker_id), `trabalhador da conversa ${chat.id}`);
  const showPhones = bothSharePhone(chat);
  const lastRead = readUpTo(chat, side);
  return {
    id: chat.id,
    service_id: chat.service_id,
    service_name: service.name,
    farmer_id: chat.farmer_id,
    worker_id: chat.worker_id,
    farmer: { name: farmer.name, photo_url: farmer.photo_url, phone: showPhones ? farmer.phone : null },
    worker: { name: worker.name, photo_url: worker.photo_url, phone: showPhones ? worker.phone : null },
    farmer_shares_phone: chat.farmer_shares_phone,
    worker_shares_phone: chat.worker_shares_phone,
    open: isOpen(chat, now),
    closes_at: chat.closes_at,
    unread: all.filter((m) => m.id > lastRead && m.sender !== side).length,
    last_message: all.at(-1) ?? null,
    insertion_date: chat.insertion_date
  };
}

export async function toChatDetail(deps: ChatViewDeps, chat: ChatRecord, side: ChatSide, now: string): Promise<ChatDetail> {
  const messages = await messagesOf(deps, chat.id);
  return { ...(await toChat(deps, chat, side, now, messages)), messages };
}

// Aviso da plataforma na conversa. Para quem causou o aviso (quem aceitou, pagou, desistiu ou liberou
// o WhatsApp) ele já conta como lido, se essa pessoa estava em dia com a conversa. Devolve a conversa atualizada.
export async function addSystemMessage(
  deps: Pick<ChatViewDeps, 'chats' | 'chatMessages'>,
  chat: ChatRecord,
  body: string,
  now: string,
  actor: ChatSide
): Promise<ChatRecord> {
  const lastBefore = (await messagesOf(deps, chat.id)).at(-1)?.id ?? 0;
  const message = await deps.chatMessages.create({ chat_id: chat.id, sender: 'system', body, insertion_date: now });
  if (readUpTo(chat, actor) < lastBefore) return chat;
  const updated = actor === 'farmer' ? { ...chat, farmer_read_up_to: message.id } : { ...chat, worker_read_up_to: message.id };
  await deps.chats.update(updated);
  return updated;
}

// Avisa a tela da conversa e a lista (com o contador do menu) dos dois lados.
export function publishChatChanges(changes: ChangeFeed, chat: ChatRecord): void {
  changes.publish([chatMessages(chat.id), profileChats('farmer', chat.farmer_id), profileChats('worker', chat.worker_id)]);
}
