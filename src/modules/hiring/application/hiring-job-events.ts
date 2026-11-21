import type { JobEvents, Service } from '#modules/services';
import type { InviteRepository } from '../domain/invite.repository';
import type { ProposalRepository } from '../domain/proposal.repository';
import { expirePendingInvites } from './invite-expiry';
import { supersedePending } from './negotiation';

// Vaga cancelada: as propostas pendentes das conversas dela deixam de valer e os convites pendentes expiram
// (ligado no módulo de serviços pelo container).
export function hiringJobEvents(deps: { proposals: ProposalRepository; invites: InviteRepository }): Pick<JobEvents, 'jobCancelled'> {
  return {
    async jobCancelled(service: Service) {
      await supersedePending(deps.proposals, { service_id: service.id });
      await expirePendingInvites(deps.invites, service.id);
    }
  };
}
