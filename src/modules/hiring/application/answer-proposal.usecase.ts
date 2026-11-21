import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { HiringEvents } from '../domain/hiring-events';
import { PROPOSAL_STATUS } from '../domain/hiring-status';
import type { ProposalRepository } from '../domain/proposal.repository';
import type { Proposal, ProposalAnswer } from '../hiring.contract';
import { publishApplicationChanges } from './hiring-notifications';
import { type NegotiationDeps, type NegotiationViewer, openNegotiation } from './negotiation';

export interface AnswerProposalDeps extends NegotiationDeps {
  proposals: ProposalRepository;
  clock: Clock;
  changes: ChangeFeed;
  events: HiringEvents;
}

export interface AnswerProposalInput {
  chatId: number;
  proposalId: number;
  viewer: NegotiationViewer;
  action: ProposalAnswer;
}

// Só o outro lado aceita ou recusa a proposta pendente da conversa. A aceita não muda mais e libera o aceite
// da candidatura pelo produtor. A resposta aparece na conversa, com push para quem propôs.
export class AnswerProposalUseCase {
  constructor(private readonly deps: AnswerProposalDeps) {}

  async execute({ chatId, proposalId, viewer, action }: AnswerProposalInput): Promise<Result<Proposal>> {
    const negotiation = await openNegotiation(this.deps, chatId, viewer);
    if (!negotiation.ok) return negotiation;
    const { application, side } = negotiation.value;

    const proposal = await this.deps.proposals.findById(proposalId);
    if (proposal?.application_id !== application.id) return notFound('Proposta não encontrada nesta conversa.');
    if (proposal.status !== PROPOSAL_STATUS.PENDING) return conflict('Esta proposta não está mais aguardando resposta.');
    if (proposal.proposed_by === side) {
      return conflict('Quem fez a proposta não pode responder a ela. Espere a resposta ou faça uma proposta nova.');
    }

    const answered: Proposal = {
      ...proposal,
      status: action === 'Accept' ? PROPOSAL_STATUS.ACCEPTED : PROPOSAL_STATUS.DECLINED,
      answered_at: this.deps.clock.now()
    };
    await this.deps.proposals.update(answered);
    await this.deps.events.proposalAnswered(answered);
    publishApplicationChanges(this.deps.changes, answered.service_id, [answered.worker_id]);
    return ok(answered);
  }
}
