import type { PushNotifier } from '#modules/notifications';
import { SERVICE_STATUS, type Service, type ServiceRepository } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { ApplicationRepository } from '../domain/application.repository';
import type { HiringEvents } from '../domain/hiring-events';
import type { HiringTransaction } from '../domain/hiring-transaction';
import { APPLICATION_STATUS } from '../domain/hiring-status';
import { notifyWithdrawal, publishApplicationChanges } from './hiring-notifications';
import { supersedePending } from './negotiation';

export interface WithdrawFromServiceDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  transaction: HiringTransaction;
  changes: ChangeFeed;
  push: PushNotifier;
  events: HiringEvents;
}

export interface WithdrawFromServiceInput {
  serviceId: number;
  workerId: number;
}

// O que a desistência desfez: a candidatura pendente, ou o serviço já aceito.
export type WithdrawOutcome = { undone: 'application' | 'service'; service: Service };

// O trabalhador desiste, e tudo volta uma etapa:
// - candidatura Pending: é removida (pode se candidatar de novo depois);
// - já aceito (serviço In Progress): o serviço volta a Pending sem trabalhador e as
//   candidaturas recusadas pelo aceite voltam a Pending para o produtor escolher outro, tudo junto.
// A conversa de quem desistiu é encerrada; as das candidaturas que voltaram a Pending reabrem.
export class WithdrawFromServiceUseCase {
  constructor(private readonly deps: WithdrawFromServiceDeps) {}

  async execute({ serviceId, workerId }: WithdrawFromServiceInput): Promise<Result<WithdrawOutcome>> {
    const { services, applications, changes, push } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const [application] = await applications.find({ service_id: service.id, worker_id: workerId });
    if (!application) return notFound('Você não tem candidatura neste serviço.');

    if (application.status === APPLICATION_STATUS.PENDING && service.status === SERVICE_STATUS.PENDING) {
      await this.deps.transaction(async (stores) => {
        await stores.applications.delete(application.id);
        await supersedePending(stores.proposals, { application_id: application.id });
      });
      await this.deps.events.withdrawn(service, workerId, []); // encerra a conversa
      publishApplicationChanges(changes, service.id, [workerId]);
      notifyWithdrawal(push, service);
      return ok({ undone: 'application', service });
    }

    if (application.status === APPLICATION_STATUS.ACCEPTED && service.status === SERVICE_STATUS.IN_PROGRESS) {
      const affected = await this.deps.transaction(async (stores) => {
        await stores.applications.delete(application.id);
        const restored = [workerId];
        for (const other of await stores.applications.find({ service_id: service.id })) {
          if (other.auto_rejected !== true) continue;
          other.status = APPLICATION_STATUS.PENDING;
          delete other.auto_rejected;
          await stores.applications.update(other);
          restored.push(other.worker_id);
        }
        service.worker_id = null;
        service.proposal_id = null;
        service.agreement = null;
        service.status = SERVICE_STATUS.PENDING;
        await stores.services.update(service);
        return restored;
      });
      await this.deps.events.withdrawn(service, workerId, affected.slice(1)); // encerra a conversa dele e reabre as dos outros
      publishApplicationChanges(changes, service.id, affected);
      notifyWithdrawal(push, service);
      return ok({ undone: 'service', service });
    }

    return conflict('Não é possível desistir: a candidatura já foi recusada ou o serviço já foi encerrado.');
  }
}
