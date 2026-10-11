import { CATEGORIES } from '#modules/services';
import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, isRecord, missingMessage } from '#shared/infra/http/body';
import type { Query } from '#shared/infra/http/types';
import { isBlank, missingFields, text, tooLong } from '#shared/utils/validation';
import { TRACK_LIMITS as LIMIT } from '../domain/track';
import { canonicalVideoUrl } from '../domain/video';
import type { LessonInput, TrackContentInput, TrackFilters, TrackInput, TrackModuleInput, TrackStatusInput, TrackUpdate } from '../track.contract';

// Formato dos corpos e das queries das rotas de trilhas (400). Regras que dependem dos dados
// (quem é tutor, ids que existem na trilha, status) ficam nos casos de uso.

const isPositiveInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;

function parseTitle(value: unknown, label: string): Result<string> {
  const title = isBlank(value) ? '' : text(value).trim();
  if (!title) return invalid(`${label} não pode ficar vazio.`);
  const problem = tooLong(label, title, LIMIT.title);
  return problem ? invalid(problem) : ok(title);
}

function parseDescription(value: unknown): Result<string> {
  const description = isBlank(value) ? '' : text(value).trim();
  if (!description) return invalid('A descrição não pode ficar vazia.');
  const problem = tooLong('A descrição', description, LIMIT.description);
  return problem ? invalid(problem) : ok(description);
}

function parseCategories(value: unknown): Result<string[]> {
  if (!Array.isArray(value) || value.length === 0) return invalid('Escolha pelo menos uma categoria.');
  const unknown = value.filter((c) => typeof c !== 'string' || !CATEGORIES.includes(c));
  if (unknown.length > 0) return invalid(`Categoria inválida. Use as de GET /api/categories: ${CATEGORIES.join(', ')}.`);
  // Na ordem da lista oficial, sem repetição.
  return ok(CATEGORIES.filter((c) => value.includes(c)));
}

export function parseTrackInput(body: Body): Result<TrackInput> {
  const missing = missingFields(body, ['title', 'description', 'categories']);
  if (missing.length > 0) return invalid(missingMessage(missing));
  const title = parseTitle(body['title'], 'O nome da trilha');
  if (!title.ok) return title;
  const description = parseDescription(body['description']);
  if (!description.ok) return description;
  const categories = parseCategories(body['categories']);
  if (!categories.ok) return categories;
  return ok({ title: title.value, description: description.value, categories: categories.value });
}

const UPDATABLE = ['title', 'description', 'categories', 'tutor_ids'];

export function parseTrackUpdate(body: Body): Result<TrackUpdate> {
  if (Object.keys(body).some((key) => !UPDATABLE.includes(key))) {
    return invalid('Só é possível alterar nome, descrição, categorias e tutores. O conteúdo muda em PUT /content e o status em PATCH /status.');
  }
  const update: TrackUpdate = {};
  if (body['title'] !== undefined) {
    const title = parseTitle(body['title'], 'O nome da trilha');
    if (!title.ok) return title;
    update.title = title.value;
  }
  if (body['description'] !== undefined) {
    const description = parseDescription(body['description']);
    if (!description.ok) return description;
    update.description = description.value;
  }
  if (body['categories'] !== undefined) {
    const categories = parseCategories(body['categories']);
    if (!categories.ok) return categories;
    update.categories = categories.value;
  }
  const tutorIds = body['tutor_ids'];
  if (tutorIds !== undefined) {
    if (!Array.isArray(tutorIds) || !tutorIds.every(isPositiveInteger)) return invalid('tutor_ids deve ser uma lista de ids de usuários de sistema.');
    if (tutorIds.length > LIMIT.tutors) return invalid(`Uma trilha pode ter no máximo ${LIMIT.tutors} tutores.`);
    update.tutor_ids = tutorIds;
  }
  return ok(update);
}

function parseItemId(value: unknown, where: string): Result<number | undefined> {
  if (value === undefined || value === null) return ok(undefined);
  return isPositiveInteger(value) ? ok(value) : invalid(`${where}: id inválido.`);
}

function parseLesson(value: unknown, where: string): Result<LessonInput> {
  if (!isRecord(value)) return invalid(`${where}: a aula deve ser um objeto.`);
  const id = parseItemId(value['id'], where);
  if (!id.ok) return id;
  const title = parseTitle(value['title'], `${where}: o título`);
  if (!title.ok) return title;

  const minutes = value['duration_minutes'];
  if (!Number.isInteger(minutes) || (minutes as number) < LIMIT.minLessonMinutes || (minutes as number) > LIMIT.maxLessonMinutes) {
    return invalid(`${where}: a duração deve ser um número inteiro de minutos entre ${LIMIT.minLessonMinutes} e ${LIMIT.maxLessonMinutes}.`);
  }

  const rawVideo = value['video_url'];
  let video: string | null = null;
  if (!isBlank(rawVideo)) {
    video = typeof rawVideo === 'string' ? canonicalVideoUrl(rawVideo) : null;
    if (video === null) return invalid(`${where}: o vídeo precisa ser um link do YouTube ou do Vimeo.`);
  }

  const rawContent = value['content'];
  if (rawContent !== undefined && rawContent !== null && typeof rawContent !== 'string') return invalid(`${where}: o texto deve ser um texto.`);
  const content = (rawContent ?? '').trim();
  const problem = tooLong(`${where}: o texto`, content, LIMIT.lessonContent);
  if (problem) return invalid(problem);
  if (!content && video === null) return invalid(`${where}: a aula precisa de um vídeo ou de um texto.`);

  const lesson: LessonInput = { title: title.value, video_url: video, content, duration_minutes: minutes as number };
  if (id.value !== undefined) lesson.id = id.value;
  return ok(lesson);
}

function parseModule(value: unknown, where: string): Result<TrackModuleInput> {
  if (!isRecord(value)) return invalid(`${where}: o módulo deve ser um objeto.`);
  const id = parseItemId(value['id'], where);
  if (!id.ok) return id;
  const title = parseTitle(value['title'], `${where}: o título`);
  if (!title.ok) return title;
  const rawLessons = value['lessons'] ?? [];
  if (!Array.isArray(rawLessons)) return invalid(`${where}: lessons deve ser uma lista.`);
  if (rawLessons.length > LIMIT.lessonsPerModule) return invalid(`${where}: no máximo ${LIMIT.lessonsPerModule} aulas por módulo.`);

  const lessons: LessonInput[] = [];
  for (const [index, raw] of rawLessons.entries()) {
    const lesson = parseLesson(raw, `${where}, aula ${index + 1}`);
    if (!lesson.ok) return lesson;
    lessons.push(lesson.value);
  }
  const mod: TrackModuleInput = { title: title.value, lessons };
  if (id.value !== undefined) mod.id = id.value;
  return ok(mod);
}

export function parseTrackContent(body: Body): Result<TrackContentInput> {
  const raw = body['modules'];
  if (!Array.isArray(raw)) return invalid(missingMessage(['modules']));
  if (raw.length > LIMIT.modules) return invalid(`Uma trilha pode ter no máximo ${LIMIT.modules} módulos.`);
  const modules: TrackModuleInput[] = [];
  for (const [index, value] of raw.entries()) {
    const mod = parseModule(value, `Módulo ${index + 1}`);
    if (!mod.ok) return mod;
    modules.push(mod.value);
  }
  return ok({ modules });
}

export function parseTrackStatus(body: Body): Result<TrackStatusInput['status']> {
  const status = body['status'];
  if (status === 'published' || status === 'discontinued') return ok(status);
  return invalid('status deve ser published ou discontinued (trilhas não são removidas nem voltam para rascunho).');
}

function queryText(query: Query, key: string): string | undefined {
  const value = query[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

// `?worker_id=` opcional: o trabalhador que está vendo (traz o progresso dele).
export function parseWorkerIdQuery(query: Query): Result<number | undefined> {
  const raw = queryText(query, 'worker_id');
  if (raw === undefined) return ok(undefined);
  const id = Number(raw);
  return isPositiveInteger(id) ? ok(id) : invalid('worker_id deve ser um número válido.');
}

export function parseTrackFilters(query: Query): Result<TrackFilters> {
  const filters: TrackFilters = {};
  const q = queryText(query, 'q');
  if (q !== undefined) {
    if (q.length > 100) return invalid('A busca pode ter no máximo 100 caracteres.');
    filters.q = q;
  }
  const category = queryText(query, 'category');
  if (category !== undefined) filters.category = category;
  const workerId = parseWorkerIdQuery(query);
  if (!workerId.ok) return workerId;
  if (workerId.value !== undefined) filters.worker_id = workerId.value;
  return ok(filters);
}

export function parseEnrollInput(body: Body): Result<{ worker_id: number }> {
  const workerId = body['worker_id'];
  if (workerId === undefined || workerId === null || workerId === '') return invalid(missingMessage(['worker_id']));
  const id = Number(workerId);
  return isPositiveInteger(id) ? ok({ worker_id: id }) : invalid('worker_id deve ser um número válido.');
}
