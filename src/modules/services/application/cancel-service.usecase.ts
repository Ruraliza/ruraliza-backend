import type { ChangeFeed } from '#shared/domain/changes';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import { APPLICATION_STATUS } from '../../../constants/status';
import { type PushNotifier, WORKER_APPLICATIONS_URL } from '../../../domain/push';
import type { ApplicationRepository } from '../../../domain/repositories';
import type { Service } from '../service.contract';
import type { ServiceRepository } from '../domain/service.repository';
import { SERVICE_STATUS } from '../domain/service-status';
import { notifyApplicants } from './notify-applicants';

export interface CancelServiceDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  changes: ChangeFeed;
  push: PushNotifier;
}

export interface CancelServiceInput {
  serviceId: number;
}

// Só enquanto Pending. As candidaturas pendentes são recusadas e os candidatos, avisados por push.
export class CancelServiceUseCase {
  constructor(private readonly deps: CancelServiceDeps) {}

  async execute({ serviceId }: CancelServiceInput): Promise<Result<Service>> {
    const { services, applications, push } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    if (service.status !== SERVICE_STATUS.PENDING) {
      return conflict('Só é possível cancelar serviços que ainda aguardam candidatos.');
    }

    // TODO(db): executar numa transação (serviço + candidaturas).
    service.status = SERVICE_STATUS.CANCELLED;
    await services.update(service);
    for (const a of await applications.find({ service_id: service.id, status: APPLICATION_STATUS.PENDING })) {
      a.status = APPLICATION_STATUS.REJECTED;
      await applications.update(a);
      push.notify('worker', a.worker_id, {
        title: 'Serviço cancelado',
        body: `O produtor cancelou ${service.name}.`,
        url: WORKER_APPLICATIONS_URL
      });
    }
    await notifyApplicants(this.deps, service.id);

    return ok(service);
  }
}
