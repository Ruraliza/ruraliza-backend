import type { HiringEvents, NegotiationChats, Proposal, ServiceApplication } from '#modules/hiring';
import { type PushNotifier, chatUrl } from '#modules/notifications';
import { type JobEvents, type Service, describeTerms } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { requireFound } from '#shared/domain/result';
import type { ChatMessageRepository, ChatRecord, ChatRepository } from '../domain/chat.repository';
import { CHAT_GRACE_DAYS, type ChatSide, firstName, graceEnd, isOpen, otherSide } from '../domain/chat.rules';
import { type ChatViewDeps, addSystemMessage, publishChatChanges } from './chat-views';
import { openChatRecord } from './open-chat.usecase';

export interface ChatHiringDeps extends ChatViewDeps {
  chats: ChatRepository;
  chatMessages: ChatMessageRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

export const HIRED_MESSAGE =
  'Contratação confirmada! Sigam o combinado da proposta aceita; no fim do serviço, o produtor libera o pagamento pelo app. ' +
  'Agora vocês podem liberar o WhatsApp no topo da conversa, e o ponto da fazenda aparece para o trabalhador.';
export const NOT_CHOSEN_MESSAGE = 'Outro trabalhador foi escolhido para este serviço. A conversa foi encerrada.';
export const REJECTED_MESSAGE = 'O produtor recusou a candidatura. A conversa foi encerrada.';
export const REOPENED_MESSAGE = 'O trabalhador escolhido desistiu e a vaga voltou a receber candidaturas. A conversa foi reaberta.';
export function inviteAcceptedMessage(workerName: string): string {
  return `${firstName(workerName)} aceitou o convite. Conversem sobre o serviço por aqui. ` +
    'Telefone e e-mail ficam ocultos; o WhatsApp só pode ser liberado depois do aceite da vaga.';
}
export const CANCELLED_MESSAGE = 'O produtor cancelou a vaga. A conversa foi encerrada.';

async function chatOf(chats: ChatRepository, serviceId: number, workerId: number): Promise<ChatRecord | undefined> {
  return (await chats.find({ service_id: serviceId, worker_id: workerId }))[0];
}

// A conversa acompanha a contratação. O produtor a abre a partir de uma candidatura (open-chat), e ela:
// - fecha quando a candidatura é recusada, quando outro é aceito, quando o trabalhador desiste e quando a vaga é cancelada;
// - reabre quando o aceito desiste e as candidaturas recusadas pelo aceite voltam a Pending;
// - depois do pagamento, fica aberta por mais CHAT_GRACE_DAYS dias.
// Cada etapa deixa um aviso da plataforma na conversa.
export function chatHiringEvents(deps: ChatHiringDeps): HiringEvents & Pick<JobEvents, 'jobCancelled'> {
  const { chats, clock, changes } = deps;

  // `actor`: quem fez a etapa (para quem o aviso já conta como lido); null quando foi outra pessoa.
  async function systemMessage(chat: ChatRecord, body: string, actor: ChatSide | null, proposalId?: number): Promise<void> {
    publishChatChanges(changes, await addSystemMessage(deps, chat, body, clock.now(), actor, proposalId));
  }

  async function nameOf(chat: ChatRecord, side: ChatSide): Promise<string> {
    const person = side === 'farmer' ? await deps.farmers.findById(chat.farmer_id) : await deps.workers.findById(chat.worker_id);
    return firstName(person?.name ?? (side === 'farmer' ? 'O produtor' : 'O trabalhador'));
  }

  function notify(chat: ChatRecord, to: ChatSide, title: string, body: string): void {
    deps.push.notify(to, to === 'farmer' ? chat.farmer_id : chat.worker_id, { title, body, url: chatUrl(to, chat.id) });
  }

  async function close(chat: ChatRecord | undefined, body: string, actor: ChatSide | null): Promise<void> {
    if (!chat || chat.closes_at !== null) return;
    const closed = { ...chat, closes_at: clock.now() };
    await chats.update(closed);
    await systemMessage(closed, body, actor);
  }

  return {
    async accepted(service: Service, autoRejected: readonly number[]) {
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
      const terms = service.agreement ? ` Combinado: ${describeTerms(service.agreement)}.` : '';
      await systemMessage(chat, `${HIRED_MESSAGE}${terms}`, 'farmer');
      for (const other of autoRejected) await close(await chatOf(chats, service.id, other), NOT_CHOSEN_MESSAGE, 'farmer');
    },

    async rejected(service: Service, workerId: number) {
      await close(await chatOf(chats, service.id, workerId), REJECTED_MESSAGE, 'farmer');
    },

    async withdrawn(service: Service, workerId: number, restored: readonly number[]) {
      const worker = requireFound(await deps.workers.findById(workerId), `trabalhador ${workerId}`);
      await close(await chatOf(chats, service.id, workerId), `${firstName(worker.name)} desistiu. A conversa foi encerrada.`, 'worker');
      for (const other of restored) {
        const chat = await chatOf(chats, service.id, other);
        if (!chat || chat.closes_at === null) continue;
        const reopened = { ...chat, closes_at: null };
        await chats.update(reopened);
        await systemMessage(reopened, REOPENED_MESSAGE, null);
      }
    },

    async paid(service: Service) {
      if (service.worker_id === null) return;
      const chat = await chatOf(chats, service.id, service.worker_id);
      if (!chat) return;
      const updated = { ...chat, closes_at: graceEnd(clock.now()) };
      await chats.update(updated);
      await systemMessage(updated, `Pagamento liberado. A conversa continua aberta por mais ${CHAT_GRACE_DAYS} dias.`, 'farmer');
    },

    async proposed(proposal: Proposal) {
      const chat = await chatOf(chats, proposal.service_id, proposal.worker_id);
      if (!chat) return;
      const name = await nameOf(chat, proposal.proposed_by);
      const terms = describeTerms(proposal);
      await systemMessage(chat, `${name} propôs ${terms}.`, proposal.proposed_by, proposal.id);
      notify(chat, otherSide(proposal.proposed_by), 'Nova proposta', `${name} propôs ${terms}. Responda na conversa.`);
    },

    async proposalAnswered(proposal: Proposal) {
      const chat = await chatOf(chats, proposal.service_id, proposal.worker_id);
      if (!chat) return;
      const answeredBy = otherSide(proposal.proposed_by);
      const name = await nameOf(chat, answeredBy);
      const accepted = proposal.status === 'Accepted';
      const next = accepted
        ? (answeredBy === 'farmer' ? ' Falta o produtor aceitar a candidatura.' : ' Agora o produtor pode aceitar a candidatura.')
        : '';
      await systemMessage(chat, `${name} ${accepted ? 'aceitou' : 'recusou'} a proposta de ${describeTerms(proposal)}.${next}`, answeredBy, proposal.id);
      notify(chat, proposal.proposed_by, accepted ? 'Proposta aceita' : 'Proposta recusada', `${name} ${accepted ? 'aceitou' : 'recusou'} sua proposta.`);
    },

    // O trabalhador aceitou o convite: a conversa abre sozinha (o push ao produtor sai da contratação).
    async inviteAccepted(service: Service, application: ServiceApplication) {
      const worker = requireFound(await deps.workers.findById(application.worker_id), `trabalhador ${application.worker_id}`);
      const { chat } = await openChatRecord(deps, {
        service, workerId: worker.id, message: inviteAcceptedMessage(worker.name), actor: 'worker', now: clock.now()
      });
      publishChatChanges(changes, chat);
      return chat.id;
    },
    async jobCancelled(service: Service) {
      for (const chat of await chats.find({ service_id: service.id })) await close(chat, CANCELLED_MESSAGE, 'farmer');
    }
  };
}

// A conversa como a contratação a vê: de que candidatura é e se ainda aceita mensagens (e propostas).
export function negotiationChats(deps: Pick<ChatHiringDeps, 'chats' | 'clock'>): NegotiationChats {
  return {
    async find(chatId: number) {
      const chat = await deps.chats.findById(chatId);
      return chat ? { id: chat.id, service_id: chat.service_id, worker_id: chat.worker_id, open: isOpen(chat, deps.clock.now()) } : null;
    }
  };
}
