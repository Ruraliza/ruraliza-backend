import { type PushNotifier, chatUrl } from '#modules/notifications';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, ok } from '#shared/domain/result';
import type { Chat } from '../chat.contract';
import type { ChatRecord } from '../domain/chat.repository';
import { type ChatSide, type ChatViewer, bothSharePhone, firstName, isOpen, otherSide } from '../domain/chat.rules';
import { type ChatViewDeps, addSystemMessage, publishChatChanges, toChat } from './chat-views';
import { findOwnChat } from './find-own-chat';

export interface SharePhoneDeps extends ChatViewDeps {
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

export interface SharePhoneInput {
  chatId: number;
  viewer: ChatViewer;
  share: boolean;
}

function withShare(chat: ChatRecord, side: ChatSide, share: boolean): ChatRecord {
  return side === 'farmer' ? { ...chat, farmer_shares_phone: share } : { ...chat, worker_shares_phone: share };
}

function shares(chat: ChatRecord, side: ChatSide): boolean {
  return side === 'farmer' ? chat.farmer_shares_phone : chat.worker_shares_phone;
}

// Consentimento duplo: cada lado libera (ou deixa de liberar) o próprio WhatsApp, e os números só
// aparecem quando os dois liberaram. Cada mudança deixa um aviso na conversa; quem ainda não
// liberou recebe push com o pedido.
export class SharePhoneUseCase {
  constructor(private readonly deps: SharePhoneDeps) {}

  async execute({ chatId, viewer, share }: SharePhoneInput): Promise<Result<Chat>> {
    const { chats, clock } = this.deps;
    const own = await findOwnChat(chats, chatId, viewer);
    if (!own.ok) return own;
    const { chat, side } = own.value;
    const now = clock.now();
    if (!isOpen(chat, now)) return conflict('Esta conversa foi encerrada.');
    if (shares(chat, side) === share) return ok(await toChat(this.deps, chat, side, now));

    const updated = withShare(chat, side, share);
    await chats.update(updated);

    const names = await this.firstNames(chat);
    const me = names[side];
    const other = otherSide(side);
    const body = !share
      ? `${me} deixou de compartilhar o WhatsApp.`
      : bothSharePhone(updated)
        ? `${me} também liberou o WhatsApp. Os dois números aparecem no topo da conversa.`
        : `${me} liberou o WhatsApp. Os números aparecem para os dois quando ${names[other]} também liberar.`;
    const withNotice = await addSystemMessage(this.deps, updated, body, now, side);
    publishChatChanges(this.deps.changes, withNotice);

    if (share) {
      this.deps.push.notify(other, other === 'farmer' ? chat.farmer_id : chat.worker_id, bothSharePhone(updated)
        ? { title: 'WhatsApp liberado', body: `Você e ${me} já podem se falar pelo WhatsApp.`, url: chatUrl(other, chat.id) }
        : { title: 'Pedido de WhatsApp', body: `${me} quer trocar WhatsApp com você.`, url: chatUrl(other, chat.id) });
    }
    return ok(await toChat(this.deps, withNotice, side, now));
  }

  private async firstNames(chat: ChatRecord): Promise<Record<ChatSide, string>> {
    const farmer = await this.deps.farmers.findById(chat.farmer_id);
    const worker = await this.deps.workers.findById(chat.worker_id);
    return { farmer: firstName(farmer?.name ?? 'O produtor'), worker: firstName(worker?.name ?? 'O trabalhador') };
  }
}
