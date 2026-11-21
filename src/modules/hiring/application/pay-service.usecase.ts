import { type PushNotifier, workerJobUrl } from '#modules/notifications';
import { SERVICE_STATUS, type Service, type ServiceRepository, money } from '#modules/services';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, notFound, ok, requireFound } from '#shared/domain/result';
import type { HiringEvents } from '../domain/hiring-events';
import type { HiringTransaction } from '../domain/hiring-transaction';
import { PAYMENT_STATUS } from '../domain/hiring-status';
import type { PaymentRepository } from '../domain/payment.repository';
import type { Payment } from '../hiring.contract';
import { publishApplicationChanges } from './hiring-notifications';

export interface PayServiceDeps {
  services: ServiceRepository;
  payments: PaymentRepository;
  transaction: HiringTransaction;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
  events: HiringEvents;
}

export interface PayServiceInput {
  serviceId: number; // a rota já conferiu que o serviço é de quem pede (access.farmerOfService)
  value: number; // total em R$ informado pelo produtor (já validado: maior que zero)
}

// RF04 - O produtor libera o pagamento (simulação) do valor total que informou e conclui o serviço.
// O total é informado porque o combinado pode ser por hora, dia, metro, hectare ou empreitada.
// O pagamento e a conclusão valem juntos: se um falhar, o serviço continua em andamento e pode ser pago de novo.
export class PayServiceUseCase {
  constructor(private readonly deps: PayServiceDeps) {}

  async execute({ serviceId, value }: PayServiceInput): Promise<Result<{ service: Service; payment: Payment }>> {
    const service = await this.deps.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    if (service.status !== SERVICE_STATUS.IN_PROGRESS) return conflict('Só é possível pagar um serviço em andamento.');

    // Serviço em andamento sempre tem trabalhador (definido no aceite).
    const workerId = requireFound(service.worker_id ?? undefined, `trabalhador do serviço ${service.id}`);
    const now = this.deps.clock.now();

    const result = await this.deps.transaction(async ({ services, payments }) => {
      const created = await payments.create({
        service_id: service.id,
        farmer_id: service.farmer_id,
        worker_id: workerId,
        value,
        status: PAYMENT_STATUS.COMPLETED,
        insertion_date: now
      });
      const paid: Service = { ...service, payment_id: created.id, status: SERVICE_STATUS.COMPLETED, completed_at: now };
      await services.update(paid);
      return { service: paid, payment: created };
    });
    await this.deps.events.paid(result.service); // a conversa fica aberta por mais alguns dias
    publishApplicationChanges(this.deps.changes, service.id, [workerId]);
    this.deps.push.notify('worker', workerId, {
      title: 'Pagamento liberado',
      body: `Pagamento de ${money(value)} liberado em ${service.name}. Conte como foi na fazenda.`,
      url: workerJobUrl(service.id) // onde ele avalia a fazenda
    });

    return ok(result);
  }
}
