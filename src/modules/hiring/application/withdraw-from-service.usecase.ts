import type { PushNotifier } from '#modules/notifications';
import { SERVICE_STATUS, type Service, type ServiceRepository } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { ApplicationRepository } from '../domain/application.repository';
import type { HiringEvents } from '../domain/hiring-events';
import { APPLICATION_STATUS } from '../domain/hiring-status';
import { notifyWithdrawal, publishApplicationChanges } from './hiring-notifications';

export interface WithdrawFromServiceDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
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
//   candidaturas recusadas pelo aceite voltam a Pending para o produtor escolher outro.
// TODO(db): executar numa transação.
export class WithdrawFromServiceUseCase {
  constructor(private readonly deps: WithdrawFromServiceDeps) {}

  async execute({ serviceId, workerId }: WithdrawFromServiceInput): Promise<Result<WithdrawOutcome>> {
    const { services, applications, changes, push } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const [application] = await applications.find({ service_id: service.id, worker_id: workerId });
    if (!application) return notFound('Você não tem candidatura neste serviço.');

    if (application.status === APPLICATION_STATUS.PENDING && service.status === SERVICE_STATUS.PENDING) {
      await applications.delete(application.id);
      publishApplicationChanges(changes, service.id, [workerId]);
      notifyWithdrawal(push, service);
      return ok({ undone: 'application', service });
    }

    if (application.status === APPLICATION_STATUS.ACCEPTED && service.status === SERVICE_STATUS.IN_PROGRESS) {
      await applications.delete(application.id);
      const affected = [workerId];
      for (const other of await applications.find({ service_id: service.id })) {
        if (other.auto_rejected !== true) continue;
        other.status = APPLICATION_STATUS.PENDING;
        delete other.auto_rejected;
        await applications.update(other);
        affected.push(other.worker_id);
      }
      service.worker_id = null;
      service.status = SERVICE_STATUS.PENDING;
      await services.update(service);
      await this.deps.events.withdrawn(service, workerId); // encerra a conversa
      publishApplicationChanges(changes, service.id, affected);
      notifyWithdrawal(push, service);
      return ok({ undone: 'service', service });
    }

    return conflict('Não é possível desistir: a candidatura já foi recusada ou o serviço já foi encerrado.');
  }
}
