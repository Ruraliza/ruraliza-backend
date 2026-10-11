import type { PaymentRepository } from '#modules/hiring';
import { type PushNotifier, farmerServiceUrl, workerJobUrl } from '#modules/notifications';
import { SERVICE_STATUS, type Service, type ServiceRepository } from '#modules/services';
import { type ChangeFeed, serviceApplications, workerApplications } from '#shared/domain/changes';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, forbidden, notFound, ok } from '#shared/domain/result';
import type { FarmReviewRepository, WorkerReviewRepository } from '../domain/review.repository';
import { isWindowOpen } from '../domain/review.rules';
import type { FarmReviewInput, FarmerServiceReviews, WorkerReviewInput, WorkerServiceReviews } from '../reviews.contract';
import { farmerView, reviewWindow, workerStillExists, workerView } from './review-views';

export interface SubmitReviewDeps {
  services: ServiceRepository;
  payments: PaymentRepository;
  workerReviews: WorkerReviewRepository;
  farmReviews: FarmReviewRepository;
  workers: WorkerRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

// Serviço concluído, dentro do prazo, ainda sem a avaliação deste lado. Devolve o fim do prazo.
async function checkReviewable(
  deps: SubmitReviewDeps,
  service: Service,
  alreadyReviewed: boolean
): Promise<Result<string>> {
  const windowEnds = await reviewWindow(deps.payments, service);
  if (service.status !== SERVICE_STATUS.COMPLETED || windowEnds === null) {
    return conflict('Só dá para avaliar depois que o serviço for concluído (pagamento liberado).');
  }
  if (alreadyReviewed) return conflict('Você já avaliou este serviço.');
  if (!isWindowOpen(windowEnds, deps.clock.now())) return conflict('O prazo para avaliar este serviço terminou.');
  return ok(windowEnds);
}

// O produtor avalia o trabalhador do serviço (pontualidade, empenho, qualidade).
// Se o trabalhador já avaliou a fazenda, as duas avaliações são publicadas juntas.
export class SubmitWorkerReviewUseCase {
  constructor(private readonly deps: SubmitReviewDeps) {}

  async execute({ serviceId, input }: { serviceId: number; input: WorkerReviewInput }): Promise<Result<FarmerServiceReviews>> {
    const { services, workerReviews, farmReviews, clock } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const reviewable = await checkReviewable(this.deps, service, (await workerReviews.find({ service_id: service.id })).length > 0);
    if (!reviewable.ok) return reviewable;
    const workerId = service.worker_id;
    if (workerId === null || !(await workerStillExists(this.deps.workers, service))) {
      return conflict('O trabalhador deste serviço não está mais na plataforma.');
    }

    // TODO(db): numa transação, com UNIQUE (service_id).
    const [counterpart] = await farmReviews.find({ service_id: service.id });
    const now = clock.now();
    await workerReviews.create({
      service_id: service.id,
      farmer_id: service.farmer_id,
      worker_id: workerId,
      punctuality: input.punctuality,
      effort: input.effort,
      quality: input.quality,
      comment: input.comment ?? null,
      insertion_date: now,
      window_ends_at: reviewable.value,
      revealed: counterpart !== undefined
    });
    if (counterpart && !counterpart.revealed) await farmReviews.update({ ...counterpart, revealed: true });

    this.deps.push.notify('worker', workerId, counterpart
      ? { title: 'Avaliações publicadas', body: `As avaliações de ${service.name} já aparecem para os dois.`, url: workerJobUrl(service.id) }
      : { title: 'Você foi avaliado', body: `O produtor avaliou seu trabalho em ${service.name}. Avalie a fazenda para ver a nota.`, url: workerJobUrl(service.id) });
    this.deps.changes.publish([serviceApplications(service.id), workerApplications(workerId)]);
    return ok(await farmerView(this.deps, service, now));
  }
}

// O trabalhador que fez o serviço avalia a propriedade (infraestrutura, condições, fiel ao anúncio).
export class SubmitFarmReviewUseCase {
  constructor(private readonly deps: SubmitReviewDeps) {}

  async execute({ serviceId, input }: { serviceId: number; input: FarmReviewInput }): Promise<Result<WorkerServiceReviews>> {
    const { services, workerReviews, farmReviews, clock } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    if (service.worker_id !== input.worker_id) return forbidden('Só quem fez o serviço pode avaliar a fazenda.');

    const reviewable = await checkReviewable(this.deps, service, (await farmReviews.find({ service_id: service.id })).length > 0);
    if (!reviewable.ok) return reviewable;

    const [counterpart] = await workerReviews.find({ service_id: service.id });
    const now = clock.now();
    await farmReviews.create({
      service_id: service.id,
      farm_id: service.farm_id,
      farmer_id: service.farmer_id,
      worker_id: input.worker_id,
      infrastructure: input.infrastructure,
      conditions: input.conditions,
      as_described: input.as_described,
      comment: input.comment ?? null,
      insertion_date: now,
      window_ends_at: reviewable.value,
      revealed: counterpart !== undefined
    });
    if (counterpart && !counterpart.revealed) await workerReviews.update({ ...counterpart, revealed: true });

    this.deps.push.notify('farmer', service.farmer_id, counterpart
      ? { title: 'Avaliações publicadas', body: `As avaliações de ${service.name} já aparecem para os dois.`, url: farmerServiceUrl(service.id) }
      : { title: 'Sua fazenda foi avaliada', body: `O trabalhador avaliou ${service.name}. Avalie o trabalho dele para ver a nota.`, url: farmerServiceUrl(service.id) });
    this.deps.changes.publish([serviceApplications(service.id), workerApplications(input.worker_id)]);
    return ok(await workerView(this.deps, service, now));
  }
}
