import { CATEGORIES } from '#modules/services';
import { type Result, invalid, ok } from '#shared/domain/result';
import type { Body } from '#shared/infra/http/body';
import { isRecord } from '#shared/infra/http/body';
import { isLatitude, isLongitude } from '#shared/utils/validation';
import { RADIUS_MAX_KM, RADIUS_MIN_KM } from '../domain/job-preferences';
import type { JobPreferences, JobPreferencesNear } from '../matching.contract';
import { RECOMMENDATIONS_DEFAULT, RECOMMENDATIONS_MAX } from '../application/recommend-jobs.usecase';

// Formato das preferências de vaga (400). O PUT troca tudo: os três campos são obrigatórios.

function parseCategories(value: unknown): Result<string[]> {
  if (!Array.isArray(value)) return invalid('As categorias (categories) devem vir numa lista (pode ser vazia).');
  const items: unknown[] = value;
  const categories = items.filter((c): c is string => typeof c === 'string' && CATEGORIES.includes(c));
  if (categories.length !== items.length) {
    const unknown = items.find((c) => typeof c !== 'string' || !CATEGORIES.includes(c));
    return invalid(`Categoria desconhecida: ${String(unknown)}. Use as de GET /api/categories.`);
  }
  return ok(categories);
}

function parseNear(value: unknown): Result<JobPreferencesNear | null> {
  if (value === null) return ok(null);
  if (!isRecord(value)) return invalid('"Perto de mim" (near) deve ser null ou { latitude, longitude, radius_km }.');
  const { latitude, longitude, radius_km: radius } = value;
  if (!isLatitude(latitude) || !isLongitude(longitude)) return invalid('Latitude e longitude inválidas em near.');
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius < RADIUS_MIN_KM || radius > RADIUS_MAX_KM) {
    return invalid(`O raio (radius_km) deve ser de ${RADIUS_MIN_KM} a ${RADIUS_MAX_KM} km.`);
  }
  return ok({ latitude, longitude, radius_km: Math.round(radius) });
}

export function parseJobPreferences(body: Body): Result<JobPreferences> {
  const categories = parseCategories(body['categories']);
  if (!categories.ok) return categories;
  if (!('near' in body)) return invalid('Envie near: null ou { latitude, longitude, radius_km }.');
  const near = parseNear(body['near']);
  if (!near.ok) return near;
  if (typeof body['alerts'] !== 'boolean') return invalid('Os avisos (alerts) devem ser true ou false.');
  return ok({ categories: categories.value, near: near.value, alerts: body['alerts'] });
}

// ?limit= das recomendações (1 a 30; padrão 10).
export function parseRecommendationLimit(value: unknown): Result<number> {
  if (value === undefined) return ok(RECOMMENDATIONS_DEFAULT);
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= RECOMMENDATIONS_MAX
    ? ok(limit)
    : invalid(`O limite (limit) deve ser um número de 1 a ${RECOMMENDATIONS_MAX}.`);
}
