import { CATEGORIES } from '#modules/services';
import { isCalendarDate } from '#shared/domain/dates';
import { blockedTermProblem } from '#shared/domain/moderation';
import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, missingMessage } from '#shared/infra/http/body';
import { missingFields } from '#shared/utils/validation';
import { BRAZIL_STATES, SPONSOR_AUDIENCES, SPONSOR_LIMITS } from '../domain/sponsor';
import type { SponsorAudience, SponsorInput, SponsorUpdate } from '../sponsor.contract';

// Formato dos patrocínios (400). Os textos passam pelo filtro de palavrões, como as vagas.

type TextField = 'sponsor' | 'title' | 'cta_label';
const LABEL: Record<TextField | 'text', string> = { sponsor: 'O anunciante', title: 'A chamada', cta_label: 'O texto do botão', text: 'O detalhe' };
const WHERE: Record<TextField | 'text', string> = { sponsor: 'no anunciante', title: 'na chamada', cta_label: 'no botão', text: 'no detalhe' };

function parseText(field: TextField, value: unknown): Result<string> {
  const textValue = typeof value === 'string' ? value.trim() : '';
  if (!textValue) return invalid(`${LABEL[field]} (${field}) não pode ficar vazio.`);
  if (textValue.length > SPONSOR_LIMITS[field]) return invalid(`${LABEL[field]} pode ter até ${SPONSOR_LIMITS[field]} caracteres.`);
  const problem = blockedTermProblem(WHERE[field], textValue);
  return problem ? invalid(problem) : ok(textValue);
}

function parseDetail(value: unknown): Result<string | null> {
  if (value === null || value === undefined) return ok(null);
  if (typeof value !== 'string') return invalid('O detalhe (text) deve ser texto ou null.');
  const detail = value.trim();
  if (detail.length > SPONSOR_LIMITS.text) return invalid(`O detalhe pode ter até ${SPONSOR_LIMITS.text} caracteres.`);
  const problem = blockedTermProblem(WHERE.text, detail);
  return problem ? invalid(problem) : ok(detail || null);
}

function parseUrl(value: unknown): Result<string> {
  const url = typeof value === 'string' ? value.trim() : '';
  if (url.length > SPONSOR_LIMITS.url) return invalid(`O endereço pode ter até ${SPONSOR_LIMITS.url} caracteres.`);
  try {
    return new URL(url).protocol === 'https:' ? ok(url) : invalid('O endereço (url) precisa começar com https://.');
  } catch {
    return invalid('O endereço (url) precisa ser um link completo, começando com https://.');
  }
}

function parseAudience(value: unknown): Result<SponsorAudience> {
  const audience = SPONSOR_AUDIENCES.find((a) => a === value);
  return audience ? ok(audience) : invalid("O público (audience) deve ser 'farmer', 'worker' ou 'all'.");
}

function parseList(value: unknown, allowed: readonly string[], field: string): Result<string[]> {
  if (!Array.isArray(value)) return invalid(`${field} deve ser uma lista (pode ser vazia).`);
  const items: unknown[] = value;
  const valid = items.filter((v): v is string => typeof v === 'string' && allowed.includes(v));
  return valid.length === items.length ? ok([...new Set(valid)]) : invalid(`Valor desconhecido em ${field}: ${String(items.find((v) => !valid.includes(v as string)))}.`);
}

function parseDay(value: unknown, field: string): Result<string | null> {
  if (value === null || value === undefined) return ok(null);
  return isCalendarDate(value) ? ok(value) : invalid(`${field} deve ser uma data AAAA-MM-DD ou null.`);
}

// Campo a campo, para a criação (com os obrigatórios) e a edição (só o que veio).
function parseFields(body: Body): Result<SponsorUpdate> {
  const changes: SponsorUpdate = {};
  for (const field of ['sponsor', 'title', 'cta_label'] as const) {
    if (body[field] === undefined) continue;
    const parsed = parseText(field, body[field]);
    if (!parsed.ok) return parsed;
    changes[field] = parsed.value;
  }
  if (body['text'] !== undefined) {
    const detail = parseDetail(body['text']);
    if (!detail.ok) return detail;
    changes.text = detail.value;
  }
  if (body['url'] !== undefined) {
    const url = parseUrl(body['url']);
    if (!url.ok) return url;
    changes.url = url.value;
  }
  if (body['audience'] !== undefined) {
    const audience = parseAudience(body['audience']);
    if (!audience.ok) return audience;
    changes.audience = audience.value;
  }
  if (body['states'] !== undefined) {
    const states = parseList(body['states'], BRAZIL_STATES, 'states');
    if (!states.ok) return states;
    changes.states = states.value;
  }
  if (body['categories'] !== undefined) {
    const categories = parseList(body['categories'], CATEGORIES, 'categories');
    if (!categories.ok) return categories;
    changes.categories = categories.value;
  }
  for (const field of ['starts_on', 'ends_on'] as const) {
    if (body[field] === undefined) continue;
    const day = parseDay(body[field], field);
    if (!day.ok) return day;
    changes[field] = day.value;
  }
  if (body['active'] !== undefined) {
    if (typeof body['active'] !== 'boolean') return invalid('Ativo (active) deve ser true ou false.');
    changes.active = body['active'];
  }
  return ok(changes);
}

export function parseSponsorInput(body: Body): Result<SponsorInput> {
  const missing = missingFields(body, ['sponsor', 'title', 'cta_label', 'url', 'audience']);
  if (missing.length > 0) return invalid(missingMessage(missing));
  const fields = parseFields(body);
  if (!fields.ok) return fields;
  const { sponsor, title, cta_label, url, audience } = fields.value;
  if (sponsor === undefined || title === undefined || cta_label === undefined || url === undefined || audience === undefined) {
    return invalid(missingMessage(['sponsor', 'title', 'cta_label', 'url', 'audience']));
  }
  return ok({ ...fields.value, sponsor, title, cta_label, url, audience });
}

export function parseSponsorUpdate(body: Body): Result<SponsorUpdate> {
  const fields = parseFields(body);
  if (!fields.ok) return fields;
  return Object.keys(fields.value).length > 0 ? fields : invalid('Envie ao menos um campo para mudar.');
}

export interface SlotQuery {
  audience: 'farmer' | 'worker';
  state: string | null;
  categories: string[];
}

// GET /sponsors/slot?audience=&state=&categories= (UF e categorias são opcionais; as desconhecidas são ignoradas).
export function parseSlotQuery(query: Readonly<Record<string, unknown>>): Result<SlotQuery> {
  const audience = query['audience'];
  if (audience !== 'farmer' && audience !== 'worker') return invalid("Diga o público em ?audience=: 'farmer' ou 'worker'.");
  const state = typeof query['state'] === 'string' ? query['state'].toUpperCase() : null;
  const raw = typeof query['categories'] === 'string' ? query['categories'].split(',') : [];
  return ok({
    audience,
    state: state !== null && BRAZIL_STATES.includes(state) ? state : null,
    categories: raw.map((c) => c.trim()).filter((c) => CATEGORIES.includes(c))
  });
}
