import type { FarmRepository } from '#modules/farms';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { type Result, notFound, ok, requireFound } from '#shared/domain/result';
import type { FarmReviewRecord, FarmReviewRepository, WorkerReviewRecord, WorkerReviewRepository } from '../domain/review.repository';
import { farmReputation, firstName, isPublished, toPublicReview, workerReputation } from '../domain/review.rules';
import type { FarmReputation, FarmReviewsPage, WorkerReputation, WorkerReviewsPage } from '../reviews.contract';

export interface GetReputationDeps {
  services: ServiceRepository;
  farms: FarmRepository;
  workers: WorkerRepository;
  workerReviews: WorkerReviewRepository;
  farmReviews: FarmReviewRepository;
  clock: Clock;
}

const newestFirst = (a: { insertion_date: string; id: number }, b: { insertion_date: string; id: number }): number =>
  b.insertion_date.localeCompare(a.insertion_date) || b.id - a.id;

// Reputação de trabalhadores e fazendas: só as avaliações publicadas contam.
// Também alimenta a lista de candidatos (hiring) e a busca de vagas (services).
// TODO(db): com o banco, a média vira uma consulta agregada (AVG/COUNT ... WHERE revealed OR window_ends_at < now()).
export class GetReputationUseCase {
  constructor(private readonly deps: GetReputationDeps) {}

  async workerPage({ workerId }: { workerId: number }): Promise<Result<WorkerReviewsPage>> {
    const { workers, services, farms } = this.deps;
    if (!(await workers.findById(workerId))) return notFound('Trabalhador não encontrado.');

    const published = (await this.publishedOfWorker(workerId)).sort(newestFirst);
    const reviews = await Promise.all(published.map(async (review) => {
      const service = requireFound(await services.findById(review.service_id), `serviço da avaliação ${review.id}`);
      const farm = requireFound(await farms.findById(service.farm_id), `fazenda do serviço ${service.id}`);
      return {
        ...toPublicReview(review),
        service_name: service.name,
        category: service.category,
        author: `Produtor em ${farm.city}, ${farm.state}`
      };
    }));
    return ok({ reputation: workerReputation(published), reviews });
  }

  async farmPage({ farmId }: { farmId: number }): Promise<Result<FarmReviewsPage>> {
    const { farms, services, workers } = this.deps;
    if (!(await farms.findById(farmId))) return notFound('Fazenda não encontrada.');

    const published = (await this.publishedOfFarm(farmId)).sort(newestFirst);
    const reviews = await Promise.all(published.map(async (review) => {
      const service = requireFound(await services.findById(review.service_id), `serviço da avaliação ${review.id}`);
      const worker = requireFound(await workers.findById(review.worker_id), `trabalhador da avaliação ${review.id}`);
      return {
        ...toPublicReview(review),
        service_name: service.name,
        category: service.category,
        author: firstName(worker.name)
      };
    }));
    return ok({ reputation: farmReputation(published), reviews });
  }

  async forWorkers(workerIds: readonly number[]): Promise<Map<number, WorkerReputation>> {
    const result = new Map<number, WorkerReputation>();
    for (const id of new Set(workerIds)) result.set(id, workerReputation(await this.publishedOfWorker(id)));
    return result;
  }

  async forFarms(farmIds: readonly number[]): Promise<Map<number, FarmReputation>> {
    const result = new Map<number, FarmReputation>();
    for (const id of new Set(farmIds)) result.set(id, farmReputation(await this.publishedOfFarm(id)));
    return result;
  }

  private async publishedOfWorker(workerId: number): Promise<WorkerReviewRecord[]> {
    const now = this.deps.clock.now();
    return (await this.deps.workerReviews.find({ worker_id: workerId })).filter((r) => isPublished(r, now));
  }

  private async publishedOfFarm(farmId: number): Promise<FarmReviewRecord[]> {
    const now = this.deps.clock.now();
    return (await this.deps.farmReviews.find({ farm_id: farmId })).filter((r) => isPublished(r, now));
  }
}
