import type { HiringEvents } from '#modules/hiring';
import type { Service } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { requireFound } from '#shared/domain/result';
import type { ChatMessageRepository, ChatRecord, ChatRepository } from '../domain/chat.repository';
import { CHAT_GRACE_DAYS, type ChatSide, firstName, graceEnd } from '../domain/chat.rules';
import { type ChatViewDeps, addSystemMessage, publishChatChanges } from './chat-views';

export interface ChatHiringDeps extends ChatViewDeps {
  chats: ChatRepository;
  chatMessages: ChatMessageRepository;
  clock: Clock;
  changes: ChangeFeed;
}

export const HIRED_MESSAGE =
  'Contratação confirmada! Combinem por aqui o horário, o ponto de encontro e o que levar. ' +
  'Os números de WhatsApp continuam protegidos até vocês dois decidirem trocar.';

async function chatOf(chats: ChatRepository, serviceId: number, workerId: number): Promise<ChatRecord | undefined> {
  return (await chats.find({ service_id: serviceId, worker_id: workerId }))[0];
}

// A conversa acompanha a contratação: abre no aceite (ou reabre, se a mesma pessoa for aceita de novo),
// fecha na desistência e, depois do pagamento, fica aberta por mais CHAT_GRACE_DAYS dias.
// Cada etapa deixa um aviso da plataforma na conversa.
export function chatHiringEvents(deps: ChatHiringDeps): HiringEvents {
  const { chats, chatMessages, clock, changes } = deps;

  // `actor`: quem fez a etapa (o produtor aceita e paga; o trabalhador desiste).
  async function systemMessage(chat: ChatRecord, body: string, actor: ChatSide): Promise<void> {
    publishChatChanges(changes, await addSystemMessage({ chats, chatMessages }, chat, body, clock.now(), actor));
  }

  return {
    async accepted(service: Service) {
      const workerId = requireFound(service.worker_id ?? undefined, `trabalhador do serviço ${service.id}`);
      const existing = await chatOf(chats, service.id, workerId);
      let chat: ChatRecord;
      if (existing) {
        chat = { ...existing, closes_at: null };
        await chats.update(chat);
      } else {
        chat = await chats.create({
          service_id: service.id,
          farmer_id: service.farmer_id,
          worker_id: workerId,
          farmer_shares_phone: false,
          worker_shares_phone: false,
          farmer_read_up_to: 0,
          worker_read_up_to: 0,
          closes_at: null,
          insertion_date: clock.now()
        });
      }
      await systemMessage(chat, HIRED_MESSAGE, 'farmer');
    },

    async withdrawn(service: Service, workerId: number) {
      const chat = await chatOf(chats, service.id, workerId);
      if (!chat) return;
      const updated = { ...chat, closes_at: clock.now() };
      await chats.update(updated);
      const worker = requireFound(await deps.workers.findById(workerId), `trabalhador ${workerId}`);
      await systemMessage(updated, `${firstName(worker.name)} desistiu do serviço. A conversa foi encerrada.`, 'worker');
    },

    async paid(service: Service) {
      if (service.worker_id === null) return;
      const chat = await chatOf(chats, service.id, service.worker_id);
      if (!chat) return;
      const updated = { ...chat, closes_at: graceEnd(clock.now()) };
      await chats.update(updated);
      await systemMessage(updated, `Pagamento liberado. A conversa continua aberta por mais ${CHAT_GRACE_DAYS} dias.`, 'farmer');
    }
  };
}
