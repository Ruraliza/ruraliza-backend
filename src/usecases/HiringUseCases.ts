import type { AnalyzeInput, Payment, Service, ServiceApplication } from '../contracts';
import { APPLICATION_STATUS, PAYMENT_STATUS, SERVICE_STATUS } from '../constants/status';
import type { Clock } from '../domain/clock';
import type { ApplicationRepository, PaymentRepository, ServiceRepository, WorkerRepository } from '../domain/repositories';
import { type Result, conflict, invalid, notFound, ok, requireFound } from '../domain/result';
import { isExpired } from './shared';

export interface AnalyzeOutcome {
  application: ServiceApplication;
  service?: Service; // só no Accept
}

// O que a desistência desfez: a candidatura pendente, ou o serviço já aceito.
export type WithdrawOutcome = { undone: 'application' | 'service'; service: Service };

// Contratação: candidatura, aceite/recusa, desistência e pagamento.
// Cada operação altera várias entidades juntas.
// TODO(db): executar cada uma numa transação.
export class HiringUseCases {
  constructor(
    private readonly repos: {
      services: ServiceRepository;
      applications: ApplicationRepository;
      workers: WorkerRepository;
      payments: PaymentRepository;
    },
    private readonly clock: Clock
  ) {}

  // RF02 - Candidata-se a um serviço aberto (uma vez por serviço).
  async apply(serviceId: number, workerId: number): Promise<Result<ServiceApplication>> {
    const { services, workers, applications } = this.repos;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const worker = await workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

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
      return ok({ application });
    }

    application.status = APPLICATION_STATUS.ACCEPTED;
    await applications.update(application);
    for (const other of await applications.find({ service_id: service.id, status: APPLICATION_STATUS.PENDING })) {
      // auto_rejected: recusada pelo aceite de outro; volta a Pending se o aceito desistir.
      other.status = APPLICATION_STATUS.REJECTED;
      other.auto_rejected = true;
      await applications.update(other);
    }
    service.worker_id = application.worker_id;
    service.status = SERVICE_STATUS.IN_PROGRESS;
    await services.update(service);

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
      return ok({ undone: 'application', service });
    }

    if (application.status === APPLICATION_STATUS.ACCEPTED && service.status === SERVICE_STATUS.IN_PROGRESS) {
      await applications.delete(application.id);
      for (const other of await applications.find({ service_id: service.id })) {
        if (other.auto_rejected !== true) continue;
        other.status = APPLICATION_STATUS.PENDING;
        delete other.auto_rejected;
        await applications.update(other);
      }
      service.worker_id = null;
      service.status = SERVICE_STATUS.PENDING;
      await services.update(service);
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

    return ok({ service, payment });
  }
}
