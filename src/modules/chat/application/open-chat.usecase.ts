import { APPLICATION_STATUS, type ApplicationRepository } from '#modules/hiring';
import { type PushNotifier, chatUrl } from '#modules/notifications';
import { SERVICE_STATUS } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, invalid, notFound, ok } from '#shared/domain/result';
import type { Service } from '#modules/services';
import type { Chat } from '../chat.contract';
import type { ChatRecord } from '../domain/chat.repository';
import { type ChatSide, firstName } from '../domain/chat.rules';
import { type ChatViewDeps, addSystemMessage, publishChatChanges, toChat } from './chat-views';

export interface OpenChatDeps extends ChatViewDeps {
  applications: ApplicationRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

export interface OpenChatInput {
  serviceId: number; // a rota já conferiu que o serviço é de quem pede (access.farmerOfService)
  applicationId: number;
}

export const OPENED_MESSAGE =
  'Conversa aberta pelo produtor sobre a candidatura. Combinem aqui o valor e a forma de pagamento por uma proposta. ' +
  'Telefone e e-mail ficam ocultos; o WhatsApp só pode ser liberado depois do aceite.';
export const REOPENED_BY_FARMER_MESSAGE = 'O produtor reabriu a conversa.';

// Só o produtor abre a conversa, a partir de uma candidatura Pending da vaga dele (ainda Pending).
// Uma conversa por candidato e vaga: abrir de novo devolve a mesma, e uma conversa encerrada
// (ex.: o trabalhador desistiu e se candidatou de novo) é reaberta. O trabalhador recebe push.
export class OpenChatUseCase {
  constructor(private readonly deps: OpenChatDeps) {}

  async execute({ serviceId, applicationId }: OpenChatInput): Promise<Result<{ chat: Chat; created: boolean }>> {
    const { services, applications, clock } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    const application = await applications.findById(applicationId);
    if (!application) return notFound('Candidatura não encontrada.');
    if (application.service_id !== service.id) return invalid('Esta candidatura não pertence a este serviço.');
    if (service.status !== SERVICE_STATUS.PENDING || application.status !== APPLICATION_STATUS.PENDING) {
      return conflict('Só é possível conversar com candidatos que aguardam resposta numa vaga aberta.');
    }

    const now = clock.now();
    const { chat, outcome } = await openChatRecord(this.deps, { service, workerId: application.worker_id, message: OPENED_MESSAGE, actor: 'farmer', now });
    if (outcome === 'already-open') return ok({ chat: await toChat(this.deps, chat, 'farmer', now), created: false });
    publishChatChanges(this.deps.changes, chat);

    const farmer = await this.deps.farmers.findById(service.farmer_id);
    this.deps.push.notify('worker', application.worker_id, {
      title: 'Conversa sobre sua candidatura',
      body: `${firstName(farmer?.name ?? 'O produtor')} quer conversar sobre ${service.name}.`,
      url: chatUrl('worker', chat.id)
    });
    return ok({ chat: await toChat(this.deps, chat, 'farmer', now), created: outcome === 'created' });
  }
}

// Abre a conversa de um candidato com a mensagem da plataforma: cria, ou reabre a encerrada (com o aviso de
// reaberta). Se ela já estava aberta, nada muda. Usada pelo produtor (acima) e pelo aceite de um convite.
export async function openChatRecord(
  deps: Pick<OpenChatDeps, 'chats' | 'chatMessages'>,
  { service, workerId, message, actor, now }: { service: Service; workerId: number; message: string; actor: ChatSide; now: string }
): Promise<{ chat: ChatRecord; outcome: 'already-open' | 'reopened' | 'created' }> {
  const [existing] = await deps.chats.find({ service_id: service.id, worker_id: workerId });
  if (existing && existing.closes_at === null) return { chat: existing, outcome: 'already-open' };
  if (existing) {
    const chat = await addSystemMessage(deps, { ...existing, closes_at: null }, actor === 'farmer' ? REOPENED_BY_FARMER_MESSAGE : message, now, actor);
    await deps.chats.update(chat);
    return { chat, outcome: 'reopened' };
  }
  const created = await deps.chats.create({
    service_id: service.id,
    farmer_id: service.farmer_id,
    worker_id: workerId,
    farmer_shares_phone: false,
    worker_shares_phone: false,
    farmer_read_up_to: 0,
    worker_read_up_to: 0,
    closes_at: null,
    insertion_date: now
  });
  return { chat: await addSystemMessage(deps, created, message, now, actor), outcome: 'created' };
}
