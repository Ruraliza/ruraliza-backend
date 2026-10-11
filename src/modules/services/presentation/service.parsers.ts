import { isCalendarDate } from '#shared/domain/dates';
import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, missingMessage } from '#shared/infra/http/body';
import type { Query } from '#shared/infra/http/types';
import { isPositiveNumber, missingFields, text, tooLong } from '#shared/utils/validation';
import type { JobFilters, JobSort, ServiceInput, ServiceUpdate } from '../service.contract';

// Formato dos corpos e das queries das rotas de serviço e de vagas (400).
// Regras que dependem dos dados (fazenda do produtor, status, validade no passado) ficam nos casos de uso.

const MAX_DESCRIPTION = 2000;

export function parseServiceInput(body: Body): Result<ServiceInput> {
  const missing = missingFields(body, ['farmer_id', 'farm_id', 'name', 'category', 'duration', 'price']);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const duration = body['duration'];
  const price = body['price'];
  if (!isPositiveNumber(duration)) return invalid('A duração deve ser um número de horas maior que zero.');
  if (!isPositiveNumber(price)) return invalid('O valor deve ser um número maior que zero.');

  const extras = parseServiceExtras(body);
  if (!extras.ok) return extras;

  return ok({
    farmer_id: Number(body['farmer_id']),
    farm_id: Number(body['farm_id']),
    name: text(body['name']).trim(),
    description: extras.value.description ?? null,
    category: text(body['category']),
    duration,
    price,
    expires_at: extras.value.expires_at ?? null
  });
}

export function parseServiceUpdate(body: Body): Result<ServiceUpdate> {
  const locked = [body['farmer_id'], body['worker_id'], body['payment_id'], body['status']];
  if (locked.some((v) => v !== undefined)) {
    return invalid('Só é possível alterar fazenda, nome, descrição, categoria, duração, valor e validade.');
  }
  const extras = parseServiceExtras(body);
  if (!extras.ok) return extras;

  const { farm_id, name, category, duration, price } = body;
  if (name !== undefined && !text(name).trim()) return invalid('O nome do serviço não pode ficar vazio.');
  if (category !== undefined && !text(category).trim()) return invalid('A categoria não pode ficar vazia.');
  if (duration !== undefined && !isPositiveNumber(duration)) {
    return invalid('A duração deve ser um número de horas maior que zero.');
  }
  if (price !== undefined && !isPositiveNumber(price)) return invalid('O valor deve ser um número maior que zero.');

  const update: ServiceUpdate = {};
  if (farm_id !== undefined) update.farm_id = Number(farm_id);
  if (name !== undefined) update.name = text(name).trim();
  if (category !== undefined) update.category = text(category);
  if (duration !== undefined) update.duration = duration;
  if (price !== undefined) update.price = price;
  if (extras.value.description !== undefined) update.description = extras.value.description;
  if (extras.value.expires_at !== undefined) update.expires_at = extras.value.expires_at;
  return ok(update);
}

// Descrição e validade (opcionais). Só aparecem no resultado se vieram no corpo;
// vazio/null limpa (sem descrição, sem prazo).
function parseServiceExtras(body: Body): Result<{ description?: string | null; expires_at?: string | null }> {
  const out: { description?: string | null; expires_at?: string | null } = {};
  const description = body['description'];
  if (description !== undefined) {
    out.description = description === null || !text(description).trim() ? null : text(description).trim();
    const problem = tooLong('A descrição', out.description, MAX_DESCRIPTION);
    if (problem) return invalid(problem);
  }
  const expiresAt = body['expires_at'];
  if (expiresAt !== undefined) {
    if (expiresAt === null || expiresAt === '') out.expires_at = null;
    else if (isCalendarDate(expiresAt)) out.expires_at = expiresAt;
    else return invalid('A validade deve ser uma data no formato AAAA-MM-DD.');
  }
  return ok(out);
}

// --- Filtros das vagas (GET /workers/services) ---

const JOB_SORTS: readonly JobSort[] = ['recent', 'price_desc', 'price_asc', 'duration_asc', 'duration_desc', 'rating'];

function queryText(query: Query, key: string): string | undefined {
  const value = query[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function parseJobFilters(query: Query): Result<JobFilters> {
  const filters: JobFilters = {};

  const q = queryText(query, 'q');
  if (q !== undefined) {
    if (q.length > 100) return invalid('A busca pode ter no máximo 100 caracteres.');
    filters.q = q;
  }
  const category = queryText(query, 'category');
  if (category !== undefined) filters.category = category;

  for (const key of ['min_hours', 'max_hours'] as const) {
    const raw = queryText(query, key);
    if (raw === undefined) continue;
    const hours = Number(raw);
    if (!Number.isFinite(hours) || hours < 0) return invalid(`${key} deve ser um número de horas maior ou igual a zero.`);
    filters[key] = hours;
  }
  if (filters.min_hours !== undefined && filters.max_hours !== undefined && filters.min_hours > filters.max_hours) {
    return invalid('min_hours não pode ser maior que max_hours.');
  }

  for (const key of ['from', 'to'] as const) {
    const raw = queryText(query, key);
    if (raw === undefined) continue;
    if (!isCalendarDate(raw)) return invalid(`${key} deve ser uma data no formato AAAA-MM-DD.`);
    filters[key] = raw;
  }
  if (filters.from && filters.to && filters.from > filters.to) return invalid('from não pode ser depois de to.');

  const minRating = queryText(query, 'min_rating');
  if (minRating !== undefined) {
    const rating = Number(minRating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return invalid('min_rating deve ser uma nota de 1 a 5.');
    filters.min_rating = rating;
  }

  const sort = queryText(query, 'sort');
  if (sort !== undefined) {
    const found = JOB_SORTS.find((s) => s === sort);
    if (!found) return invalid(`sort inválido. Use um destes: ${JOB_SORTS.join(', ')}.`);
    filters.sort = found;
  }

  const workerId = parseWorkerIdQuery(query);
  if (!workerId.ok) return workerId;
  if (workerId.value !== undefined) filters.worker_id = workerId.value;
  return ok(filters);
}

// `?worker_id=` opcional: o trabalhador que está vendo a vaga.
export function parseWorkerIdQuery(query: Query): Result<number | undefined> {
  const raw = queryText(query, 'worker_id');
  if (raw === undefined) return ok(undefined);
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) return invalid('worker_id deve ser um número válido.');
  return ok(id);
}
