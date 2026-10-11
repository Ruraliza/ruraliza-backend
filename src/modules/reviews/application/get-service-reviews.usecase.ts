import type { PaymentRepository } from '#modules/hiring';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { type Result, forbidden, notFound, ok } from '#shared/domain/result';
import type { FarmReviewRepository, WorkerReviewRepository } from '../domain/review.repository';
import type { FarmerServiceReviews, WorkerServiceReviews } from '../reviews.contract';
import { farmerView, workerView } from './review-views';

export interface GetServiceReviewsDeps {
  services: ServiceRepository;
  payments: PaymentRepository;
  workerReviews: WorkerReviewRepository;
  farmReviews: FarmReviewRepository;
  workers: WorkerRepository;
  clock: Clock;
}

// As avaliações de um serviço do ponto de vista de cada lado: a que escreveu, a que recebeu
// (só depois de publicada) e se ainda pode avaliar.
export class GetServiceReviewsUseCase {
  constructor(private readonly deps: GetServiceReviewsDeps) {}

  async forFarmer({ serviceId }: { serviceId: number }): Promise<Result<FarmerServiceReviews>> {
    const service = await this.deps.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    return ok(await farmerView(this.deps, service, this.deps.clock.now()));
  }

  async forWorker({ serviceId, workerId }: { serviceId: number; workerId: number }): Promise<Result<WorkerServiceReviews>> {
    const service = await this.deps.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    if (service.worker_id !== workerId) return forbidden('Só quem fez o serviço vê as avaliações dele.');
    return ok(await workerView(this.deps, service, this.deps.clock.now()));
  }
}
