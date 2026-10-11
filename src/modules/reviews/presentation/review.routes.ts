import type { AccessPolicies } from '#modules/auth';
import { TAGS, operation, pathParam, queryParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { ReviewController } from './review.controller';
import type { ReviewSchemaName } from './review.schemas';

const serviceId = pathParam('id', 'ID do serviço.');
const reviewOperation = operation<ReviewSchemaName>;

const BLIND =
  'A avaliação é **cega**: a nota de cada lado só aparece para o outro (e entra na reputação) quando os dois avaliaram, ' +
  'ou quando o prazo de 14 dias depois do pagamento termina. Depois de enviada, não pode ser editada.';

export interface ReviewRoutes {
  // Em /api/farmers, junto das rotas '/services/...' (antes de '/:id').
  farmer: readonly RouteDef[];
  // Em /api/workers, junto das vagas (antes de '/:id').
  worker: readonly RouteDef[];
  // Em /api/reviews: reputação publicada de trabalhadores e fazendas.
  reputation: readonly RouteDef[];
}

export function reviewRoutes(reviews: ReviewController, access: AccessPolicies): ReviewRoutes {
  return {
    farmer: [
      route('get', '/services/:id/reviews', reviews.farmerServiceReviews, reviewOperation({
        tag: TAGS.reviews,
        summary: 'Avaliações do serviço (produtor)',
        description: 'A avaliação que o produtor deu ao trabalhador, a que a fazenda recebeu (se publicada) e se ainda dá para avaliar. ' + BLIND,
        params: [serviceId],
        success: { status: 200, description: 'Estado das avaliações do serviço.', schema: 'FarmerServiceReviews' },
        errors: { 404: 'Serviço não encontrado.' }
      }), access.farmerOfService()),

      route('post', '/services/:id/review', reviews.reviewWorker, reviewOperation({
        tag: TAGS.reviews,
        summary: 'Avaliar o trabalhador',
        description: 'Notas inteiras de 1 a 5 para pontualidade, empenho e qualidade, e um comentário opcional. ' + BLIND,
        params: [serviceId],
        body: 'WorkerReviewInput',
        success: { status: 201, description: 'Avaliação registrada; traz o estado atualizado.', schema: 'FarmerReviewResponse' },
        errors: {
          400: 'Nota fora de 1 a 5 (ou não inteira); comentário com mais de 500 caracteres.',
          404: 'Serviço não encontrado.',
          409: 'O serviço ainda não foi concluído; o produtor já avaliou; o prazo para avaliar terminou.'
        }
      }), access.farmerOfService()),

      route('get', '/:id/reviews/pending', reviews.farmerPendingReviews, reviewOperation({
        tag: TAGS.reviews,
        summary: 'Avaliações pendentes do produtor',
        description: 'Serviços concluídos, ainda no prazo, em que o produtor não avaliou o trabalhador. O que vence primeiro vem antes.',
        params: [pathParam('id', 'ID do produtor.')],
        success: { status: 200, description: 'Serviços esperando avaliação.', schema: { listOf: 'PendingReview' } }
      }), access.ownFarmer())
    ],
    worker: [
      route('get', '/services/:id/reviews', reviews.workerServiceReviews, reviewOperation({
        tag: TAGS.reviews,
        summary: 'Avaliações do serviço (trabalhador)',
        description: 'A avaliação que o trabalhador deu à fazenda, a que ele recebeu (se publicada) e se ainda dá para avaliar. ' + BLIND,
        params: [serviceId, queryParam('worker_id', 'Trabalhador que fez o serviço (obrigatório).', { type: 'integer', minimum: 1 })],
        success: { status: 200, description: 'Estado das avaliações do serviço.', schema: 'WorkerServiceReviews' },
        errors: { 400: '`worker_id` faltando.', 403: 'O trabalhador não fez este serviço.', 404: 'Serviço não encontrado.' }
      }), access.worker()),

      route('post', '/services/:id/review', reviews.reviewFarm, reviewOperation({
        tag: TAGS.reviews,
        summary: 'Avaliar a fazenda',
        description: 'Notas inteiras de 1 a 5 para infraestrutura, condições de trabalho e se o serviço foi como o anúncio dizia, e um comentário opcional. ' + BLIND,
        params: [serviceId],
        body: 'FarmReviewInput',
        success: { status: 201, description: 'Avaliação registrada; traz o estado atualizado.', schema: 'WorkerReviewResponse' },
        errors: {
          400: '`worker_id` faltando; nota fora de 1 a 5 (ou não inteira); comentário com mais de 500 caracteres.',
          403: 'O trabalhador não fez este serviço.',
          404: 'Serviço não encontrado.',
          409: 'O serviço ainda não foi concluído; o trabalhador já avaliou; o prazo para avaliar terminou.'
        }
      }), access.workerInBody()),

      route('get', '/:id/reviews/pending', reviews.workerPendingReviews, reviewOperation({
        tag: TAGS.reviews,
        summary: 'Avaliações pendentes do trabalhador',
        description: 'Serviços concluídos, ainda no prazo, em que o trabalhador não avaliou a fazenda. O que vence primeiro vem antes.',
        params: [pathParam('id', 'ID do trabalhador.')],
        success: { status: 200, description: 'Serviços esperando avaliação.', schema: { listOf: 'PendingReview' } }
      }), access.ownWorker())
    ],
    reputation: [
      route('get', '/workers/:id', reviews.workerReviewsPage, reviewOperation({
        tag: TAGS.reviews,
        summary: 'Reputação de um trabalhador',
        description: 'Média, notas por critério e as avaliações publicadas (as mais novas primeiro). Quem avaliou aparece só como "Produtor em <cidade>".',
        params: [pathParam('id', 'ID do trabalhador.')],
        success: { status: 200, description: 'Reputação e avaliações.', schema: 'WorkerReviewsPage' },
        errors: { 404: 'Trabalhador não encontrado.' }
      }), access.anyAccount),

      route('get', '/farms/:id', reviews.farmReviewsPage, reviewOperation({
        tag: TAGS.reviews,
        summary: 'Reputação de uma fazenda',
        description: 'Média, notas por critério e as avaliações publicadas (as mais novas primeiro). Quem avaliou aparece só pelo primeiro nome.',
        params: [pathParam('id', 'ID da fazenda.')],
        success: { status: 200, description: 'Reputação e avaliações.', schema: 'FarmReviewsPage' },
        errors: { 404: 'Fazenda não encontrada.' }
      }), access.anyAccount)
    ]
  };
}
