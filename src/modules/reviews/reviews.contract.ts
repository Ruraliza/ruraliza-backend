import type { MessageResponse } from '#shared/contracts/api';

// Avaliação dupla depois do serviço concluído (pago). Notas inteiras de 1 a 5.
// Cega: a nota de um lado só aparece quando o outro também avaliou, ou quando o prazo acaba.

// O produtor avalia o trabalhador.
export interface WorkerReviewScores {
  punctuality: number; // chegou e cumpriu o horário combinado
  effort: number; // empenho durante o serviço
  quality: number; // o trabalho ficou bem feito
}

// O trabalhador avalia a propriedade.
export interface FarmReviewScores {
  infrastructure: number; // ferramentas, equipamentos e instalações
  conditions: number; // água, sombra, EPI e segurança
  as_described: number; // o serviço foi como o anúncio dizia
}

export interface WorkerReview extends WorkerReviewScores {
  id: number;
  service_id: number;
  farmer_id: number; // quem avaliou
  worker_id: number; // quem foi avaliado
  comment: string | null;
  insertion_date: string;
}

export interface FarmReview extends FarmReviewScores {
  id: number;
  service_id: number;
  farm_id: number; // a propriedade avaliada
  farmer_id: number; // dono da fazenda
  worker_id: number; // quem avaliou
  comment: string | null;
  insertion_date: string;
}

// POST /farmers/services/:id/review
export interface WorkerReviewInput extends WorkerReviewScores {
  comment?: string | null; // até 500 caracteres
}

// POST /workers/services/:id/review
export interface FarmReviewInput extends FarmReviewScores {
  worker_id: number;
  comment?: string | null;
}

// Reputação: só as avaliações já publicadas contam. `average` e os critérios têm uma casa decimal
// (null sem avaliações); `score` é a média ponderada pela quantidade, usada para ordenar
// (quem tem uma nota 5 não passa na frente de quem tem vinte notas 4,8).
export interface WorkerReputation {
  average: number | null;
  count: number;
  score: number;
  punctuality: number | null;
  effort: number | null;
  quality: number | null;
}

export interface FarmReputation {
  average: number | null;
  count: number;
  score: number;
  infrastructure: number | null;
  conditions: number | null;
  as_described: number | null;
}

// Avaliação publicada com o contexto do serviço. `author` não identifica a pessoa:
// "Produtor em Três Rios, RJ" (avaliações do trabalhador) ou o primeiro nome do trabalhador.
export interface WorkerReviewItem extends WorkerReview {
  service_name: string;
  category: string;
  author: string;
}

export interface FarmReviewItem extends FarmReview {
  service_name: string;
  category: string;
  author: string;
}

// GET /reviews/workers/:id e GET /reviews/farms/:id
export interface WorkerReviewsPage {
  reputation: WorkerReputation;
  reviews: WorkerReviewItem[];
}

export interface FarmReviewsPage {
  reputation: FarmReputation;
  reviews: FarmReviewItem[];
}

// As avaliações de um serviço vistas por um dos lados.
export interface ServiceReviews<Given, Received> {
  can_review: boolean; // serviço concluído, dentro do prazo e ainda sem a sua avaliação
  window_ends_at: string | null; // fim do prazo para avaliar (null enquanto o serviço não foi concluído)
  given: Given | null; // a que você escreveu
  received: Received | null; // a que você recebeu, só depois de publicada
  received_hidden: boolean; // a outra parte já avaliou; aparece quando você avaliar (ou o prazo acabar)
}

// GET /farmers/services/:id/reviews
export type FarmerServiceReviews = ServiceReviews<WorkerReview, FarmReview>;
// GET /workers/services/:id/reviews?worker_id=
export type WorkerServiceReviews = ServiceReviews<FarmReview, WorkerReview>;

export interface FarmerReviewResponse extends MessageResponse {
  reviews: FarmerServiceReviews;
}

export interface WorkerReviewResponse extends MessageResponse {
  reviews: WorkerServiceReviews;
}

// GET /farmers/:id/reviews/pending e GET /workers/:id/reviews/pending
export interface PendingReview {
  service_id: number;
  service_name: string;
  category: string;
  window_ends_at: string;
  subject: string; // quem você vai avaliar: o nome do trabalhador, ou "Fazenda em Três Rios, RJ"
  photo_url: string | null; // foto do trabalhador, ou a capa da fazenda
  received_hidden: boolean;
}
