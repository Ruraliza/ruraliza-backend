import { invalid } from '#shared/domain/result';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type {
  FarmReviewsPage,
  FarmerReviewResponse,
  FarmerServiceReviews,
  PendingReview,
  WorkerReviewResponse,
  WorkerReviewsPage,
  WorkerServiceReviews
} from '../reviews.contract';
import type { ReviewUseCases } from '../reviews.module';
import { parseFarmReviewInput, parseWorkerReviewInput } from './review.parsers';

// HTTP das avaliações: o produtor avalia o trabalhador, o trabalhador avalia a fazenda,
// cada um vê as do serviço e o que falta avaliar; e qualquer conta vê a reputação publicada.
export interface ReviewController {
  farmerServiceReviews: Handler<FarmerServiceReviews, IdParams>;
  reviewWorker: Handler<FarmerReviewResponse, IdParams>;
  farmerPendingReviews: Handler<PendingReview[], IdParams>;
  workerServiceReviews: Handler<WorkerServiceReviews, IdParams>;
  reviewFarm: Handler<WorkerReviewResponse, IdParams>;
  workerPendingReviews: Handler<PendingReview[], IdParams>;
  workerReviewsPage: Handler<WorkerReviewsPage, IdParams>;
  farmReviewsPage: Handler<FarmReviewsPage, IdParams>;
}

export function createReviewController(reviews: ReviewUseCases): ReviewController {
  // GET /api/farmers/services/:id/reviews - As avaliações do serviço vistas pelo produtor
  const farmerServiceReviews: Handler<FarmerServiceReviews, IdParams> = async (req, res) => {
    const result = await reviews.getServiceReviews.forFarmer({ serviceId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // POST /api/farmers/services/:id/review - O produtor avalia o trabalhador
  const reviewWorker: Handler<FarmerReviewResponse, IdParams> = async (req, res) => {
    const input = parseWorkerReviewInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await reviews.submitWorkerReview.execute({ serviceId: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Review saved.', reviews: result.value });
  };

  // GET /api/farmers/:id/reviews/pending - Serviços concluídos esperando a avaliação do produtor
  const farmerPendingReviews: Handler<PendingReview[], IdParams> = async (req, res) => {
    res.status(200).json(await reviews.listPendingReviews.forFarmer({ farmerId: toId(req.params.id) }));
  };

  // GET /api/workers/services/:id/reviews?worker_id= - As avaliações do serviço vistas pelo trabalhador
  const workerServiceReviews: Handler<WorkerServiceReviews, IdParams> = async (req, res) => {
    const workerId = Number(req.query['worker_id']);
    if (!Number.isInteger(workerId) || workerId <= 0) { sendFailure(res, invalid('Informe o worker_id.')); return; }

    const result = await reviews.getServiceReviews.forWorker({ serviceId: toId(req.params.id), workerId });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // POST /api/workers/services/:id/review - O trabalhador avalia a fazenda
  const reviewFarm: Handler<WorkerReviewResponse, IdParams> = async (req, res) => {
    const input = parseFarmReviewInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await reviews.submitFarmReview.execute({ serviceId: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Review saved.', reviews: result.value });
  };

  // GET /api/workers/:id/reviews/pending - Serviços concluídos esperando a avaliação do trabalhador
  const workerPendingReviews: Handler<PendingReview[], IdParams> = async (req, res) => {
    res.status(200).json(await reviews.listPendingReviews.forWorker({ workerId: toId(req.params.id) }));
  };

  // GET /api/reviews/workers/:id - Reputação e avaliações publicadas de um trabalhador
  const workerReviewsPage: Handler<WorkerReviewsPage, IdParams> = async (req, res) => {
    const result = await reviews.getReputation.workerPage({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // GET /api/reviews/farms/:id - Reputação e avaliações publicadas de uma fazenda
  const farmReviewsPage: Handler<FarmReviewsPage, IdParams> = async (req, res) => {
    const result = await reviews.getReputation.farmPage({ farmId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  return {
    farmerServiceReviews, reviewWorker, farmerPendingReviews,
    workerServiceReviews, reviewFarm, workerPendingReviews,
    workerReviewsPage, farmReviewsPage
  };
}
