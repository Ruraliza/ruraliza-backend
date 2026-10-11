import { type PushNotifier, workerJobUrl } from '#modules/notifications';
import { SERVICE_STATUS, type Service, type ServiceRepository } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, notFound, ok, requireFound } from '#shared/domain/result';
import type { HiringEvents } from '../domain/hiring-events';
import { PAYMENT_STATUS } from '../domain/hiring-status';
import type { PaymentRepository } from '../domain/payment.repository';
import type { Payment } from '../hiring.contract';
import { publishApplicationChanges } from './hiring-notifications';

export interface PayServiceDeps {
  services: ServiceRepository;
  payments: PaymentRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
  events: HiringEvents;
}

export interface PayServiceInput {
  serviceId: number;
}

// RF04 - Libera o pagamento (simulação) e conclui o serviço.
// TODO(db): executar numa transação.
export class PayServiceUseCase {
  constructor(private readonly deps: PayServiceDeps) {}

  async execute({ serviceId }: PayServiceInput): Promise<Result<{ service: Service; payment: Payment }>> {
    const { services, payments } = this.deps;
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
      insertion_date: this.deps.clock.now()
    });
    service.payment_id = payment.id;
    service.status = SERVICE_STATUS.COMPLETED;
    await services.update(service);
    await this.deps.events.paid(service); // a conversa fica aberta por mais alguns dias
    publishApplicationChanges(this.deps.changes, service.id, [workerId]);
    this.deps.push.notify('worker', workerId, {
      title: 'Pagamento liberado',
      body: `O pagamento de ${service.name} foi liberado. Conte como foi na fazenda.`,
      url: workerJobUrl(service.id) // onde ele avalia a fazenda
    });

    return ok({ service, payment });
  }
}
