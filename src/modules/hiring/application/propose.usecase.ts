import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { maskContacts } from '#shared/domain/contacts';
import { type Result, conflict, ok } from '#shared/domain/result';
import type { HiringEvents } from '../domain/hiring-events';
import { PROPOSAL_STATUS } from '../domain/hiring-status';
import type { HiringTransaction } from '../domain/hiring-transaction';
import type { ProposalRepository } from '../domain/proposal.repository';
import type { Proposal, ProposalInput } from '../hiring.contract';
import { publishApplicationChanges } from './hiring-notifications';
import { type NegotiationDeps, type NegotiationViewer, acceptedProposal, openNegotiation, supersedePending } from './negotiation';

export interface ProposeDeps extends NegotiationDeps {
  proposals: ProposalRepository;
  transaction: HiringTransaction;
  clock: Clock;
  changes: ChangeFeed;
  events: HiringEvents;
}

export interface ProposeInput {
  chatId: number;
  viewer: NegotiationViewer;
  terms: ProposalInput; // já validada (valor, listas, observações)
}

// Proposta de valor (por unidade) na conversa de uma candidatura, feita por qualquer lado enquanto a conversa
// está aberta e a vaga está Pending. A nova substitui a pendente (Superseded), tudo junto. Depois de uma
// proposta aceita, não há outra: ela já é a concordância dos dois. Aparece na conversa, com push para o outro lado.
export class ProposeUseCase {
  constructor(private readonly deps: ProposeDeps) {}

  async execute({ chatId, viewer, terms }: ProposeInput): Promise<Result<Proposal>> {
    const negotiation = await openNegotiation(this.deps, chatId, viewer);
    if (!negotiation.ok) return negotiation;
    const { service, application, side } = negotiation.value;
    if (await acceptedProposal(this.deps.proposals, application.id)) {
      return conflict('Vocês já têm uma proposta aceita. Falta o produtor aceitar a candidatura.');
    }

    const notes = terms.notes ? maskContacts(terms.notes).text : null;
    const proposal = await this.deps.transaction(async ({ proposals }) => {
      await supersedePending(proposals, { application_id: application.id });
      return proposals.create({
        application_id: application.id,
        service_id: service.id,
        farmer_id: service.farmer_id,
        worker_id: application.worker_id,
        amount: terms.amount,
        unit: terms.unit,
        notes,
        proposed_by: side,
        status: PROPOSAL_STATUS.PENDING,
        insertion_date: this.deps.clock.now(),
        answered_at: null
      });
    });
    await this.deps.events.proposed(proposal);
    publishApplicationChanges(this.deps.changes, service.id, [application.worker_id]);
    return ok(proposal);
  }
}
