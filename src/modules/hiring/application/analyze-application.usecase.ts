import { type PushNotifier, WORKER_APPLICATIONS_URL } from '#modules/notifications';
import { SERVICE_STATUS, type Service, type ServiceRepository } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import { type Result, conflict, invalid, notFound, ok } from '#shared/domain/result';
import type { ApplicationRepository } from '../domain/application.repository';
import type { HiringEvents } from '../domain/hiring-events';
import type { HiringTransaction } from '../domain/hiring-transaction';
import type { ProposalRepository } from '../domain/proposal.repository';
import type { Clock } from '#shared/domain/clock';
import { APPLICATION_STATUS } from '../domain/hiring-status';
import type { AnalyzeInput, ServiceApplication } from '../hiring.contract';
import { publishApplicationChanges, rejectedMessage } from './hiring-notifications';
import { expirePendingInvites } from './invite-expiry';
import { acceptedProposal, agreementOf, supersedePending } from './negotiation';

export interface AnalyzeApplicationDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  proposals: ProposalRepository;
  transaction: HiringTransaction;
  changes: ChangeFeed;
  push: PushNotifier;
  events: HiringEvents;
  clock: Clock;
}

export interface AnalyzeApplicationInput extends AnalyzeInput {
  serviceId: number;
}

export interface AnalyzeOutcome {
  application: ServiceApplication;
  service?: Service; // só no Accept
}

// RF03 - Aceita ou recusa uma candidatura.
// Accept: exige uma proposta aceita pelos dois na conversa (ela é a confirmação do trabalhador). O serviço vai
// para In Progress com o combinado, e as demais pendentes são recusadas (auto_rejected), tudo junto.
// As propostas pendentes das candidaturas recusadas deixam de valer (Superseded), e os convites pendentes expiram.
// A conversa da candidatura recusada (e as dos recusados pelo aceite) é encerrada.
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
      await this.deps.transaction(async (stores) => {
        application.status = APPLICATION_STATUS.REJECTED;
        await stores.applications.update(application);
        await supersedePending(stores.proposals, { application_id: application.id });
      });
      publishApplicationChanges(changes, service.id, [application.worker_id]);
      await this.deps.events.rejected(service, application.worker_id); // encerra a conversa
      push.notify('worker', application.worker_id, rejectedMessage(service));
      return ok({ application });
    }

    const agreed = await acceptedProposal(this.deps.proposals, application.id);
    if (!agreed) {
      return conflict('Para aceitar, combinem antes o valor na conversa: uma proposta precisa estar aceita pelos dois.');
    }

    const autoRejected = await this.deps.transaction(async (stores) => {
      application.status = APPLICATION_STATUS.ACCEPTED;
      await stores.applications.update(application);
      const rejected: number[] = [];
      for (const other of await stores.applications.find({ service_id: service.id, status: APPLICATION_STATUS.PENDING })) {
        // auto_rejected: recusada pelo aceite de outro; volta a Pending se o aceito desistir.
        other.status = APPLICATION_STATUS.REJECTED;
        other.auto_rejected = true;
        await stores.applications.update(other);
        await supersedePending(stores.proposals, { application_id: other.id });
        rejected.push(other.worker_id);
      }
      service.worker_id = application.worker_id;
      service.proposal_id = agreed.id;
      service.agreement = agreementOf(agreed, this.deps.clock.now());
      service.status = SERVICE_STATUS.IN_PROGRESS;
      await stores.services.update(service);
      await expirePendingInvites(stores.invites, service.id); // a vaga saiu de Pending
      return rejected;
    });
    await this.deps.events.accepted(service, autoRejected); // avisa na conversa do aceito e encerra as dos outros
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
