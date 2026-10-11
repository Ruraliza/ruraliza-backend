import type { FarmReputation, FarmReview, FarmReviewScores, WorkerReputation, WorkerReview, WorkerReviewScores } from '../reviews.contract';
import type { Visibility } from './review.repository';

// Prazo para avaliar, contado do pagamento. Depois dele ninguém avalia mais e o que foi
// escrito aparece mesmo que o outro lado não tenha avaliado.
export const REVIEW_WINDOW_DAYS = 14;
export const MAX_REVIEW_COMMENT = 500;

export const WORKER_CRITERIA = ['punctuality', 'effort', 'quality'] as const satisfies readonly (keyof WorkerReviewScores)[];
export const FARM_CRITERIA = ['infrastructure', 'conditions', 'as_described'] as const satisfies readonly (keyof FarmReviewScores)[];

const DAY_MS = 24 * 60 * 60 * 1000;

export function windowEndsAt(completedAt: string): string {
  return new Date(Date.parse(completedAt) + REVIEW_WINDOW_DAYS * DAY_MS).toISOString();
}

export function isWindowOpen(endsAt: string, now: string): boolean {
  return Date.parse(now) < Date.parse(endsAt);
}

// Publicada: os dois avaliaram, ou o prazo acabou.
export function isPublished(review: Visibility, now: string): boolean {
  return review.revealed || !isWindowOpen(review.window_ends_at, now);
}

// Média ponderada (bayesiana): cada perfil começa com PRIOR_WEIGHT notas "imaginárias" iguais a
// PRIOR_MEAN. Com poucas avaliações a nota fica perto do meio; com muitas, vale a média real.
const PRIOR_MEAN = 3.5;
const PRIOR_WEIGHT = 2;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

interface Summary {
  average: number | null;
  count: number;
  score: number;
}

function summarize<C extends string>(reviews: readonly Readonly<Record<C, number>>[], criteria: readonly C[]): Summary & Record<C, number | null> {
  const overall = reviews.map((r) => mean(criteria.map((c) => r[c])) ?? 0);
  const average = mean(overall);
  const byCriterion = {} as Record<C, number | null>;
  for (const c of criteria) {
    const value = mean(reviews.map((r) => r[c]));
    byCriterion[c] = value === null ? null : roundTo(value, 1);
  }
  const sum = overall.reduce((s, v) => s + v, 0);
  return {
    average: average === null ? null : roundTo(average, 1),
    count: reviews.length,
    score: roundTo((PRIOR_MEAN * PRIOR_WEIGHT + sum) / (PRIOR_WEIGHT + reviews.length), 3),
    ...byCriterion
  };
}

export function workerReputation(reviews: readonly WorkerReview[]): WorkerReputation {
  return summarize(reviews, WORKER_CRITERIA);
}

export function farmReputation(reviews: readonly FarmReview[]): FarmReputation {
  return summarize(reviews, FARM_CRITERIA);
}

// Tira os campos internos (prazo e revelação) antes de responder.
export function toPublicReview<T extends Visibility>(record: T): Omit<T, keyof Visibility> {
  const review: Partial<T> = { ...record };
  delete review.window_ends_at;
  delete review.revealed;
  return review as Omit<T, keyof Visibility>;
}

// "Maria da Silva" -> "Maria": quem escreveu aparece só pelo primeiro nome.
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
