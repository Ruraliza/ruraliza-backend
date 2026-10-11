import { type Result, invalid, ok } from '#shared/domain/result';
import type { Body } from '#shared/infra/http/body';
import { text, tooLong } from '#shared/utils/validation';
import { FARM_CRITERIA, MAX_REVIEW_COMMENT, WORKER_CRITERIA } from '../domain/review.rules';
import type { FarmReviewInput, FarmReviewScores, WorkerReviewInput, WorkerReviewScores } from '../reviews.contract';

// Formato dos corpos das avaliações (400). Regras que dependem dos dados (serviço concluído,
// prazo, avaliação repetida) ficam nos casos de uso.

function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function parseScores<C extends string>(body: Body, criteria: readonly C[], labels: string): Result<Record<C, number>> {
  const scores = {} as Record<C, number>;
  for (const criterion of criteria) {
    const value = body[criterion];
    if (!isScore(value)) return invalid(`Dê uma nota inteira de 1 a 5 para cada item: ${labels}.`);
    scores[criterion] = value;
  }
  return ok(scores);
}

// Comentário opcional: vazio vira null.
function parseComment(body: Body): Result<string | null> {
  const raw = body['comment'];
  if (raw === undefined || raw === null) return ok(null);
  const comment = text(raw).trim();
  const problem = tooLong('O comentário', comment, MAX_REVIEW_COMMENT);
  return problem ? invalid(problem) : ok(comment || null);
}

export function parseWorkerReviewInput(body: Body): Result<WorkerReviewInput> {
  const scores = parseScores<keyof WorkerReviewScores>(body, WORKER_CRITERIA, 'pontualidade (punctuality), empenho (effort) e qualidade (quality)');
  if (!scores.ok) return scores;
  const comment = parseComment(body);
  if (!comment.ok) return comment;
  return ok({ ...scores.value, comment: comment.value });
}

export function parseFarmReviewInput(body: Body): Result<FarmReviewInput> {
  const workerId = body['worker_id'];
  if (!workerId) return invalid('Informe o worker_id.');
  const scores = parseScores<keyof FarmReviewScores>(body, FARM_CRITERIA, 'infraestrutura (infrastructure), condições (conditions) e fiel ao anúncio (as_described)');
  if (!scores.ok) return scores;
  const comment = parseComment(body);
  if (!comment.ok) return comment;
  return ok({ worker_id: Number(workerId), ...scores.value, comment: comment.value });
}
