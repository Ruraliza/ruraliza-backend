import { type AccountRepository, findAccountOf } from '#modules/accounts';
import { type PushNotifier, farmerServiceUrl } from '#modules/notifications';
import { SERVICE_STATUS, type ServiceRepository, isExpired } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { WorkerRepository } from '../../../domain/repositories';
import type { ApplicationRepository } from '../domain/application.repository';
import { APPLICATION_STATUS } from '../domain/hiring-status';
import type { ServiceApplication } from '../hiring.contract';
import { publishApplicationChanges } from './hiring-notifications';

export interface ApplyForServiceDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  workers: WorkerRepository;
  accounts: AccountRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

export interface ApplyForServiceInput {
  serviceId: number;
  workerId: number;
}

// RF02 - Candidata-se a um serviço aberto (uma vez por serviço) e avisa o produtor.
export class ApplyForServiceUseCase {
  constructor(private readonly deps: ApplyForServiceDeps) {}

  async execute({ serviceId, workerId }: ApplyForServiceInput): Promise<Result<ServiceApplication>> {
    const { services, workers, applications } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const worker = await workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    // Conta com os dois perfis: o trabalhador não concorre ao serviço que ele mesmo publicou.
    const account = await findAccountOf(this.deps.accounts, 'worker', worker.id);
    if (account?.farmer_id === service.farmer_id) {
      return conflict('Você não pode se candidatar a um serviço que você mesmo publicou.');
    }

    if (service.status !== SERVICE_STATUS.PENDING) {
      return conflict('Este serviço não está mais aberto para candidaturas.');
    }
    if (isExpired(service, this.deps.clock.now())) {
      return conflict('O prazo para se candidatar a esta vaga terminou.');
    }

    const existing = await applications.find({ service_id: service.id, worker_id: worker.id });
    if (existing.some((a) => a.status === APPLICATION_STATUS.REJECTED)) {
      return conflict('Sua candidatura a este serviço foi recusada e você não pode se candidatar novamente.');
    }
    if (existing.length > 0) return conflict('Você já se candidatou a este serviço.');

    const application = await applications.create({
      service_id: service.id,
      worker_id: worker.id,
      status: APPLICATION_STATUS.PENDING,
      insertion_date: this.deps.clock.now()
    });
    publishApplicationChanges(this.deps.changes, service.id, [worker.id]);
    this.deps.push.notify('farmer', service.farmer_id, {
      title: 'Nova candidatura',
      body: `${worker.name} se candidatou a ${service.name}.`,
      url: farmerServiceUrl(service.id)
    });
    return ok(application);
  }
}
