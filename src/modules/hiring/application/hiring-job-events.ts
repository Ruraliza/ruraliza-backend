import type { JobEvents, Service } from '#modules/services';
import type { ProposalRepository } from '../domain/proposal.repository';
import { supersedePending } from './negotiation';

// Vaga cancelada: as propostas pendentes das conversas dela deixam de valer (ligado no módulo de serviços pelo container).
export function hiringJobEvents(deps: { proposals: ProposalRepository }): Pick<JobEvents, 'jobCancelled'> {
  return {
    async jobCancelled(service: Service) {
      await supersedePending(deps.proposals, { service_id: service.id });
    }
  };
}
