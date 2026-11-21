import { SERVICE_STATUS, type Service, type ServiceAgreement, type ServiceRepository } from '#modules/services';
import { type Result, conflict, forbidden, notFound, ok, requireFound } from '#shared/domain/result';
import type { ApplicationRepository } from '../domain/application.repository';
import type { NegotiationChat, NegotiationChats } from '../domain/hiring-events';
import { APPLICATION_STATUS, PROPOSAL_STATUS } from '../domain/hiring-status';
import type { ProposalRepository } from '../domain/proposal.repository';
import type { Proposal, ProposalSide, ServiceApplication } from '../hiring.contract';

// Quem está agindo: os perfis da conta que fez a requisição.
export interface NegotiationViewer {
  farmerId: number | null;
  workerId: number | null;
}

export interface Negotiation {
  chat: NegotiationChat;
  service: Service;
  application: ServiceApplication;
  side: ProposalSide;
}

export interface NegotiationDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  chats: NegotiationChats;
}

// A negociação da conversa: a vaga, a candidatura e o lado de quem pede. Só vale com a conversa aberta,
// a vaga aberta (Pending) e a candidatura aguardando resposta.
export async function openNegotiation(deps: NegotiationDeps, chatId: number, viewer: NegotiationViewer): Promise<Result<Negotiation>> {
  const chat = await deps.chats.find(chatId);
  if (!chat) return notFound('Conversa não encontrada.');
  const service = requireFound(await deps.services.findById(chat.service_id), `serviço da conversa ${chat.id}`);
  const side: ProposalSide | null = viewer.farmerId !== null && viewer.farmerId === service.farmer_id
    ? 'farmer'
    : viewer.workerId !== null && viewer.workerId === chat.worker_id ? 'worker' : null;
  if (side === null) return forbidden('Esta conversa é de outras pessoas.');
  if (!chat.open) return conflict('Esta conversa foi encerrada.');
  const [application] = await deps.applications.find({ service_id: service.id, worker_id: chat.worker_id });
  if (!application || application.status !== APPLICATION_STATUS.PENDING || service.status !== SERVICE_STATUS.PENDING) {
    return conflict('Só é possível negociar enquanto a vaga está aberta e a candidatura aguarda resposta.');
  }
  return ok({ chat, service, application, side });
}

// Proposta pendente que deixou de valer: a conversa fechou (recusa, aceite de outro, desistência,
// cancelamento) ou veio uma proposta nova.
export async function supersedePending(proposals: ProposalRepository, criteria: { application_id: number } | { service_id: number }): Promise<void> {
  for (const proposal of await proposals.find({ ...criteria, status: PROPOSAL_STATUS.PENDING })) {
    await proposals.update({ ...proposal, status: PROPOSAL_STATUS.SUPERSEDED });
  }
}

export async function acceptedProposal(proposals: ProposalRepository, applicationId: number): Promise<Proposal | null> {
  return (await proposals.find({ application_id: applicationId, status: PROPOSAL_STATUS.ACCEPTED }))[0] ?? null;
}

// O combinado guardado no serviço no aceite: a cópia da proposta aceita.
export function agreementOf(proposal: Proposal, now: string): ServiceAgreement {
  const { amount, unit, notes } = proposal;
  return { amount, unit, notes, agreed_at: proposal.answered_at ?? now };
}
