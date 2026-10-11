import { type PushNotifier, chatUrl } from '#modules/notifications';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, ok } from '#shared/domain/result';
import type { ChatMessage } from '../chat.contract';
import { type ChatViewer, bothSharePhone, firstName, isOpen, maskContacts, otherSide } from '../domain/chat.rules';
import { type ChatViewDeps, publishChatChanges } from './chat-views';
import { findOwnChat } from './find-own-chat';

export interface SendMessageDeps extends ChatViewDeps {
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

export interface SendMessageInput {
  chatId: number;
  viewer: ChatViewer;
  body: string;
}

const PREVIEW_LENGTH = 100;

// Envia uma mensagem na conversa aberta. Antes de os dois liberarem o WhatsApp, telefone e
// e-mail escritos no texto saem ocultos. A outra parte recebe push; quem envia já leu até aqui.
export class SendMessageUseCase {
  constructor(private readonly deps: SendMessageDeps) {}

  async execute({ chatId, viewer, body }: SendMessageInput): Promise<Result<{ sent: ChatMessage; masked: boolean }>> {
    const { chats, chatMessages, clock } = this.deps;
    const own = await findOwnChat(chats, chatId, viewer);
    if (!own.ok) return own;
    const { chat, side } = own.value;
    const now = clock.now();
    if (!isOpen(chat, now)) return conflict('Esta conversa foi encerrada.');

    const { text, masked } = bothSharePhone(chat) ? { text: body, masked: false } : maskContacts(body);
    const sent = await chatMessages.create({ chat_id: chat.id, sender: side, body: text, insertion_date: now });
    const updated = side === 'farmer' ? { ...chat, farmer_read_up_to: sent.id } : { ...chat, worker_read_up_to: sent.id };
    await chats.update(updated);
    publishChatChanges(this.deps.changes, updated);

    const senderName = side === 'farmer'
      ? (await this.deps.farmers.findById(chat.farmer_id))?.name
      : (await this.deps.workers.findById(chat.worker_id))?.name;
    const recipient = otherSide(side);
    this.deps.push.notify(recipient, recipient === 'farmer' ? chat.farmer_id : chat.worker_id, {
      title: `Nova mensagem de ${firstName(senderName ?? 'Ruraliza')}`,
      body: text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH - 1)}…` : text,
      url: chatUrl(recipient, chat.id)
    });
    return ok({ sent, masked });
  }
}
