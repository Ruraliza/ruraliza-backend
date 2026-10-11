import { SERVICE_STATUS, type ServiceRepository, isExpired } from '#modules/services';
import type { AnalyzeInput, ApplicationWithWorker, Payment, Service, ServiceApplication } from '../contracts';
import { APPLICATION_STATUS, PAYMENT_STATUS } from '../constants/status';
import { type ChangeFeed, type ChangeListener, type ChangeTopic, serviceApplications, workerApplications } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type PushMessage, type PushNotifier, WORKER_APPLICATIONS_URL, farmerServiceUrl } from '../domain/push';
import type { AccountRepository, ApplicationRepository, PaymentRepository, WorkerRepository } from '../domain/repositories';
import { type Result, conflict, invalid, notFound, ok, requireFound } from '#shared/domain/result';
import { toPublicProfile } from '#shared/utils/profile';
import { findAccountOf } from './accounts';

export interface AnalyzeOutcome {
  application: ServiceApplication;
  service?: Service; // só no Accept
}

// O que a desistência desfez: a candidatura pendente, ou o serviço já aceito.
export type WithdrawOutcome = { undone: 'application' | 'service'; service: Service };

// Contratação: candidatura, aceite/recusa, desistência e pagamento, e as candidaturas de cada serviço.
// Cada operação altera várias entidades juntas e, no fim, avisa as telas abertas do serviço
// e dos trabalhadores afetados (`changes`) e manda push para quem precisa agir ou saber (`push`).
// TODO(db): executar cada uma numa transação.
export class HiringUseCases {
  constructor(
    private readonly repos: {
      services: ServiceRepository;
      applications: ApplicationRepository;
      workers: WorkerRepository;
      payments: PaymentRepository;
      accounts: AccountRepository;
    },
    private readonly clock: Clock,
    private readonly changes: ChangeFeed,
    private readonly push: PushNotifier
  ) {}

  // RF02 - Candidata-se a um serviço aberto (uma vez por serviço).
  async apply(serviceId: number, workerId: number): Promise<Result<ServiceApplication>> {
    const { services, workers, applications } = this.repos;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const worker = await workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    // Conta com os dois perfis: o trabalhador não concorre ao serviço que ele mesmo publicou.
    const account = await findAccountOf(this.repos.accounts, 'worker', worker.id);
    if (account?.farmer_id === service.farmer_id) {
      return conflict('Você não pode se candidatar a um serviço que você mesmo publicou.');
    }

    if (service.status !== SERVICE_STATUS.PENDING) {
      return conflict('Este serviço não está mais aberto para candidaturas.');
    }
    if (isExpired(service, this.clock.now())) {
      return conflict('O prazo para se candidatar a esta vaga terminou.');
    }

    const existing = await applications.find({ service_id: service.id, worker_id: worker.id });
    if (existing.some(a => a.status === APPLICATION_STATUS.REJECTED)) {
      return conflict('Sua candidatura a este serviço foi recusada e você não pode se candidatar novamente.');
    }
    if (existing.length > 0) return conflict('Você já se candidatou a este serviço.');

    const application = await applications.create({
      service_id: service.id,
      worker_id: worker.id,
      status: APPLICATION_STATUS.PENDING,
      insertion_date: this.clock.now()
    });
    this.notify(service.id, [worker.id]);
    this.push.notify('farmer', service.farmer_id, {
      title: 'Nova candidatura',
      body: `${worker.name} se candidatou a ${service.name}.`,
      url: farmerServiceUrl(service.id)
    });
    return ok(application);
  }

  // RF03 - Aceita ou recusa uma candidatura.
  // Accept: serviço vai para In Progress e as demais pendentes são recusadas (auto_rejected).
  async analyze(serviceId: number, { application_id, action }: AnalyzeInput): Promise<Result<AnalyzeOutcome>> {
    const { services, applications } = this.repos;
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
      this.notify(service.id, [application.worker_id]);
      this.push.notify('worker', application.worker_id, rejectedMessage(service));
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
    this.notify(service.id, [application.worker_id, ...autoRejected]);
    this.push.notify('worker', application.worker_id, {
      title: 'Você foi aceito!',
      body: `O produtor aceitou sua candidatura em ${service.name}.`,
      url: WORKER_APPLICATIONS_URL
    });
    for (const workerId of autoRejected) this.push.notify('worker', workerId, rejectedMessage(service));

    return ok({ application, service });
  }

  // O trabalhador desiste, e tudo volta uma etapa:
  // - candidatura Pending: é removida (pode se candidatar de novo depois);
  // - já aceito (serviço In Progress): o serviço volta a Pending sem trabalhador e as
  //   candidaturas recusadas pelo aceite voltam a Pending para o produtor escolher outro.
  async withdraw(serviceId: number, workerId: number): Promise<Result<WithdrawOutcome>> {
    const { services, applications } = this.repos;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const [application] = await applications.find({ service_id: service.id, worker_id: workerId });
    if (!application) return notFound('Você não tem candidatura neste serviço.');

    if (application.status === APPLICATION_STATUS.PENDING && service.status === SERVICE_STATUS.PENDING) {
      await applications.delete(application.id);
      this.notify(service.id, [workerId]);
      this.notifyWithdrawal(service);
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
      this.notify(service.id, affected);
      this.notifyWithdrawal(service);
      return ok({ undone: 'service', service });
    }

    return conflict('Não é possível desistir: a candidatura já foi recusada ou o serviço já foi encerrado.');
  }

  // RF04 - Libera o pagamento (simulação) e conclui o serviço.
  async pay(serviceId: number): Promise<Result<{ service: Service; payment: Payment }>> {
    const { services, payments } = this.repos;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    if (service.status !== SERVICE_STATUS.IN_PROGRESS) return conflict('Só é possível pagar um serviço em andamento.');

    // Serviço em andamento sempre tem trabalhador (definido no aceite).
    const workerId = requireFound(service.worker_id ?? undefined, `trabalhador do serviço ${service.id}`);

    const payment = await payments.create({
      service_id: service.id,
      farmer_id: service.farmer_id,
      worker_id: workerId,
      value: service.price,
      status: PAYMENT_STATUS.COMPLETED,
      insertion_date: this.clock.now()
    });
    service.payment_id = payment.id;
    service.status = SERVICE_STATUS.COMPLETED;
    await services.update(service);
    this.notify(service.id, [workerId]);
    this.push.notify('worker', workerId, {
      title: 'Pagamento liberado',
      body: `O pagamento de ${service.name} foi liberado.`,
      url: WORKER_APPLICATIONS_URL
    });

    return ok({ service, payment });
  }

  // Candidaturas do serviço com o trabalhador embutido (CPF mascarado).
  async listApplications(serviceId: number): Promise<Result<ApplicationWithWorker[]>> {
    const { services, applications, workers } = this.repos;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const own = await applications.find({ service_id: service.id });
    const result = await Promise.all(
      own.map(async (a): Promise<ApplicationWithWorker> => {
        const worker = requireFound(await workers.findById(a.worker_id), `trabalhador da candidatura ${a.id}`);
        return { ...a, worker: toPublicProfile(worker) };
      })
    );
    return ok(result);
  }

  // Acompanha as candidaturas do serviço (tela do produtor); devolve a função que para de acompanhar.
  async watchApplications(serviceId: number, listener: ChangeListener): Promise<Result<() => void>> {
    const service = await this.repos.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    return ok(this.changes.subscribe(serviceApplications(service.id), listener));
  }

  // Avisa a tela de candidaturas do serviço e a de cada trabalhador afetado.
  private notify(serviceId: number, workerIds: readonly number[]): void {
    const topics: ChangeTopic[] = [serviceApplications(serviceId), ...workerIds.map(workerApplications)];
    this.changes.publish(topics);
  }

  private notifyWithdrawal(service: Service): void {
    this.push.notify('farmer', service.farmer_id, {
      title: 'Desistência',
      body: `Um trabalhador desistiu de ${service.name}.`,
      url: farmerServiceUrl(service.id)
    });
  }
}

function rejectedMessage(service: Service): PushMessage {
  return { title: 'Candidatura recusada', body: `Sua candidatura em ${service.name} não foi aceita.`, url: WORKER_APPLICATIONS_URL };
}
