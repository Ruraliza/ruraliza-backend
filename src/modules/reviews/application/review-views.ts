import type { PaymentRepository } from '#modules/hiring';
import { SERVICE_STATUS, type Service } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { FarmReviewRecord, FarmReviewRepository, Visibility, WorkerReviewRecord, WorkerReviewRepository } from '../domain/review.repository';
import { isPublished, isWindowOpen, toPublicReview, windowEndsAt } from '../domain/review.rules';
import type { FarmerServiceReviews, ServiceReviews, WorkerServiceReviews } from '../reviews.contract';

export interface ReviewViewDeps {
  payments: PaymentRepository;
  workerReviews: WorkerReviewRepository;
  farmReviews: FarmReviewRepository;
  workers: WorkerRepository;
}

// Fim do prazo para avaliar: 14 dias depois do pagamento. null enquanto o serviço não foi concluído.
export async function reviewWindow(payments: PaymentRepository, service: Service): Promise<string | null> {
  if (service.status !== SERVICE_STATUS.COMPLETED || service.payment_id === null) return null;
  const payment = await payments.findById(service.payment_id);
  return payment ? windowEndsAt(payment.insertion_date) : null;
}

function view<G extends Visibility, R extends Visibility>(
  windowEnds: string | null,
  given: G | undefined,
  received: R | undefined,
  now: string
): ServiceReviews<Omit<G, keyof Visibility>, Omit<R, keyof Visibility>> {
  const receivedPublished = received !== undefined && isPublished(received, now);
  return {
    can_review: windowEnds !== null && given === undefined && isWindowOpen(windowEnds, now),
    window_ends_at: windowEnds,
    given: given === undefined ? null : toPublicReview(given),
    received: received !== undefined && receivedPublished ? toPublicReview(received) : null,
    received_hidden: received !== undefined && !receivedPublished
  };
}

async function reviewsOf(deps: ReviewViewDeps, serviceId: number): Promise<{ ofWorker?: WorkerReviewRecord; ofFarm?: FarmReviewRecord }> {
  const [ofWorker] = await deps.workerReviews.find({ service_id: serviceId });
  const [ofFarm] = await deps.farmReviews.find({ service_id: serviceId });
  return { ...(ofWorker ? { ofWorker } : {}), ...(ofFarm ? { ofFarm } : {}) };
}

// O produtor escreve a avaliação do trabalhador e recebe a da fazenda. Trabalhador que removeu o
// perfil não pode mais ser avaliado (as avaliações dele saíram junto).
export async function farmerView(deps: ReviewViewDeps, service: Service, now: string): Promise<FarmerServiceReviews> {
  const { ofWorker, ofFarm } = await reviewsOf(deps, service.id);
  const state = view(await reviewWindow(deps.payments, service), ofWorker, ofFarm, now);
  if (state.can_review && !(await workerStillExists(deps.workers, service))) state.can_review = false;
  return state;
}

export async function workerStillExists(workers: WorkerRepository, service: Service): Promise<boolean> {
  return service.worker_id !== null && (await workers.findById(service.worker_id)) !== undefined;
}

// O trabalhador escreve a avaliação da fazenda e recebe a dele.
export async function workerView(deps: ReviewViewDeps, service: Service, now: string): Promise<WorkerServiceReviews> {
  const { ofWorker, ofFarm } = await reviewsOf(deps, service.id);
  return view(await reviewWindow(deps.payments, service), ofFarm, ofWorker, now);
}
