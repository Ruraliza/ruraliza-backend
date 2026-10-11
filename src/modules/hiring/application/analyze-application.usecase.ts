import { type PushNotifier, WORKER_APPLICATIONS_URL } from '#modules/notifications';
import { SERVICE_STATUS, type Service, type ServiceRepository } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import { type Result, conflict, invalid, notFound, ok } from '#shared/domain/result';
import type { ApplicationRepository } from '../domain/application.repository';
import type { HiringEvents } from '../domain/hiring-events';
import { APPLICATION_STATUS } from '../domain/hiring-status';
import type { AnalyzeInput, ServiceApplication } from '../hiring.contract';
import { publishApplicationChanges, rejectedMessage } from './hiring-notifications';

export interface AnalyzeApplicationDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  changes: ChangeFeed;
  push: PushNotifier;
  events: HiringEvents;
}

export interface AnalyzeApplicationInput extends AnalyzeInput {
  serviceId: number;
}

export interface AnalyzeOutcome {
  application: ServiceApplication;
  service?: Service; // só no Accept
}

// RF03 - Aceita ou recusa uma candidatura.
// Accept: o serviço vai para In Progress e as demais pendentes são recusadas (auto_rejected).
// TODO(db): executar numa transação.
export class AnalyzeApplicationUseCase {
  constructor(private readonly deps: AnalyzeApplicationDeps) {}

  async execute({ serviceId, application_id, action }: AnalyzeApplicationInput): Promise<Result<AnalyzeOutcome>> {
    const { services, applications, changes, push } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const application = await applications.findById(application_id);
    if (!application) return notFound('Candidatura não encontrada.');
    if (application.service_id !== service.id) return invalid('Esta candidatura não pertence a este serviço.');
    if (service.status !== SERVICE_STATUS.PENDING) return conflict('Este serviço não está mais aguardando trabalhador.');
    if (application.status !== APPLICATION_STATUS.PENDING) return conflict('Esta candidatura já foi analisada.');

    if (action === 'Reject') {
      application.status = APPLICATION_STATUS.REJECTED;
      await applications.update(application);
      publishApplicationChanges(changes, service.id, [application.worker_id]);
      push.notify('worker', application.worker_id, rejectedMessage(service));
      return ok({ application });
    }

    application.status = APPLICATION_STATUS.ACCEPTED;
    await applications.update(application);
    const autoRejected: number[] = [];
    for (const other of await applications.find({ service_id: service.id, status: APPLICATION_STATUS.PENDING })) {
      // auto_rejected: recusada pelo aceite de outro; volta a Pending se o aceito desistir.
      other.status = APPLICATION_STATUS.REJECTED;
      other.auto_rejected = true;
      await applications.update(other);
      autoRejected.push(other.worker_id);
    }
    service.worker_id = application.worker_id;
    service.status = SERVICE_STATUS.IN_PROGRESS;
    await services.update(service);
    await this.deps.events.accepted(service); // abre a conversa
    publishApplicationChanges(changes, service.id, [application.worker_id, ...autoRejected]);
    push.notify('worker', application.worker_id, {
      title: 'Você foi aceito!',
      body: `O produtor aceitou sua candidatura em ${service.name}.`,
      url: WORKER_APPLICATIONS_URL
    });
    for (const workerId of autoRejected) push.notify('worker', workerId, rejectedMessage(service));

    return ok({ application, service });
  }
}
