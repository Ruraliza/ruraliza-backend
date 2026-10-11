import type { FarmRepository } from '#modules/farms';
import type { PaymentRepository } from '#modules/hiring';
import { SERVICE_STATUS, type Service, type ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { requireFound } from '#shared/domain/result';
import type { FarmReviewRepository, WorkerReviewRepository } from '../domain/review.repository';
import { isWindowOpen } from '../domain/review.rules';
import type { PendingReview } from '../reviews.contract';
import { reviewWindow } from './review-views';

export interface ListPendingReviewsDeps {
  services: ServiceRepository;
  payments: PaymentRepository;
  farms: FarmRepository;
  workers: WorkerRepository;
  workerReviews: WorkerReviewRepository;
  farmReviews: FarmReviewRepository;
  clock: Clock;
}

const byDeadline = (a: PendingReview, b: PendingReview): number => a.window_ends_at.localeCompare(b.window_ends_at);

// Serviços concluídos, ainda dentro do prazo, esperando a avaliação de quem pergunta
// (o que vence primeiro vem antes). Aparecem no início de cada painel.
export class ListPendingReviewsUseCase {
  constructor(private readonly deps: ListPendingReviewsDeps) {}

  async forFarmer({ farmerId }: { farmerId: number }): Promise<PendingReview[]> {
    const { services, workers, workerReviews, farmReviews } = this.deps;
    const pending: PendingReview[] = [];
    for (const service of await services.find({ farmer_id: farmerId, status: SERVICE_STATUS.COMPLETED })) {
      const windowEnds = await this.openWindow(service);
      if (windowEnds === null || service.worker_id === null) continue;
      if ((await workerReviews.find({ service_id: service.id })).length > 0) continue;
      const worker = await workers.findById(service.worker_id);
      if (!worker) continue; // removeu o perfil: não há mais quem avaliar
      pending.push({
        ...this.base(service, windowEnds),
        subject: worker.name,
        photo_url: worker.photo_url,
        received_hidden: (await farmReviews.find({ service_id: service.id })).length > 0
      });
    }
    return pending.sort(byDeadline);
  }

  async forWorker({ workerId }: { workerId: number }): Promise<PendingReview[]> {
    const { services, farms, workerReviews, farmReviews } = this.deps;
    const pending: PendingReview[] = [];
    for (const service of await services.find({ worker_id: workerId, status: SERVICE_STATUS.COMPLETED })) {
      const windowEnds = await this.openWindow(service);
      if (windowEnds === null) continue;
      if ((await farmReviews.find({ service_id: service.id })).length > 0) continue;
      const farm = requireFound(await farms.findById(service.farm_id), `fazenda do serviço ${service.id}`);
      pending.push({
        ...this.base(service, windowEnds),
        subject: `Fazenda em ${farm.city}, ${farm.state}`,
        photo_url: farm.photos[0]?.url ?? null,
        received_hidden: (await workerReviews.find({ service_id: service.id })).length > 0
      });
    }
    return pending.sort(byDeadline);
  }

  private async openWindow(service: Service): Promise<string | null> {
    const windowEnds = await reviewWindow(this.deps.payments, service);
    return windowEnds !== null && isWindowOpen(windowEnds, this.deps.clock.now()) ? windowEnds : null;
  }

  private base(service: Service, windowEnds: string): Pick<PendingReview, 'service_id' | 'service_name' | 'category' | 'window_ends_at'> {
    return { service_id: service.id, service_name: service.name, category: service.category, window_ends_at: windowEnds };
  }
}
