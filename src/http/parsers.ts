import type {
  AnalyzeAction,
  AnalyzeInput,
  JobFilters,
  JobSort,
  FarmInput,
  FarmUpdate,
  FarmerInput,
  FarmerUpdate,
  ServiceInput,
  ServiceUpdate,
  WorkerActionInput,
  WorkerUpdate
} from '../contracts';
import { isCalendarDate } from '../domain/dates';
import { type Result, invalid, ok } from '../domain/result';
import type { NewWorker } from '../usecases/WorkerUseCases';
import { normalizeEmail } from '../utils/profile';
import { isPositiveNumber, isValidCpf, isValidEmail, missingFields, text } from '../utils/validation';
import { type Body, missingMessage } from './body';
import type { Query } from './types';

// Limites de tamanho dos textos livres (evita perfis e anúncios gigantes).
const MAX_BIO = 500;
const MAX_LONG_TEXT = 1000;
const MAX_DESCRIPTION = 2000;

function tooLong(label: string, value: string | null | undefined, max: number): string | null {
  return value && value.length > max ? `${label} pode ter no máximo ${max} caracteres.` : null;
}

// Validação do formato dos corpos (400). Regras que dependem dos dados (unicidade, existência,
// estado do serviço) ficam nos casos de uso.

// --- Perfis ---

const REQUIRED_PROFILE_FIELDS = ['email', 'name', 'phone', 'cpf'] as const;

export function parseProfileInput(body: Body): Result<FarmerInput> {
  const missing = missingFields(body, REQUIRED_PROFILE_FIELDS);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const email = normalizeEmail(body['email']);
  if (!isValidEmail(email)) return invalid('E-mail inválido. Use o formato nome@dominio.com.');

  const cpf = body['cpf'];
  if (!isValidCpf(cpf)) return invalid('CPF inválido. Envie os 11 dígitos, só números, e confira se estão corretos.');

  return ok({ email, name: text(body['name']).trim(), phone: text(body['phone']), cpf });
}

// Só os campos enviados aparecem no resultado.
export function parseProfileUpdate(body: Body): Result<FarmerUpdate> {
  if (body['id'] !== undefined || body['cpf'] !== undefined) {
    return invalid('Não é permitido alterar o id ou o cpf.');
  }

  const update: FarmerUpdate = {};
  if (body['email'] !== undefined) {
    const email = normalizeEmail(body['email']);
    if (!isValidEmail(email)) return invalid('E-mail inválido. Use o formato nome@dominio.com.');
    update.email = email;
  }
  if (body['name'] !== undefined) update.name = text(body['name']).trim();
  if (body['phone'] !== undefined) update.phone = text(body['phone']);
  return ok(update);
}

// Texto opcional do perfil (certificados, experiência): vazio vira null no cadastro.
function optionalText(value: unknown): string | null {
  return value ? text(value) : null;
}

// Na edição, null limpa o campo; qualquer outro valor é guardado como texto.
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

const WORKER_TEXTS = [
  ['bio', 'A apresentação', MAX_BIO],
  ['certificates', 'Certificados', MAX_LONG_TEXT],
  ['courses', 'Cursos', MAX_LONG_TEXT],
  ['experience', 'Experiência', MAX_LONG_TEXT]
] as const;

function workerTextProblem(values: Partial<Record<(typeof WORKER_TEXTS)[number][0], string | null>>): string | null {
  for (const [field, label, max] of WORKER_TEXTS) {
    const problem = tooLong(label, values[field], max);
    if (problem) return problem;
  }
  return null;
}

export function parseWorkerInput(body: Body): Result<NewWorker> {
  const profile = parseProfileInput(body);
  if (!profile.ok) return profile;
  const worker: NewWorker = {
    ...profile.value,
    bio: optionalText(body['bio']),
    certificates: optionalText(body['certificates']),
    courses: optionalText(body['courses']),
    experience: optionalText(body['experience'])
  };
  const problem = workerTextProblem(worker);
  return problem ? invalid(problem) : ok(worker);
}

export function parseWorkerUpdate(body: Body): Result<WorkerUpdate> {
  const profile = parseProfileUpdate(body);
  if (!profile.ok) return profile;

  const update: WorkerUpdate = { ...profile.value };
  for (const [field] of WORKER_TEXTS) {
    if (body[field] !== undefined) update[field] = nullableText(body[field]);
  }
  const problem = workerTextProblem(update);
  return problem ? invalid(problem) : ok(update);
}

// --- Fazendas ---

const FARM_FIELDS = ['address', 'city', 'state'] as const satisfies readonly (keyof FarmInput)[];

export function parseFarmInput(body: Body): Result<FarmInput> {
  const missing = missingFields(body, FARM_FIELDS);
  if (missing.length > 0) return invalid(missingMessage(missing));
  return ok({ address: text(body['address']), city: text(body['city']), state: text(body['state']) });
}

export function parseFarmUpdate(body: Body): Result<FarmUpdate> {
  if (body['id'] !== undefined || body['farmer_id'] !== undefined) {
    return invalid('Só é possível alterar endereço, cidade e estado.');
  }

  const blank = FARM_FIELDS.filter((f) => body[f] !== undefined && !text(body[f]).trim());
  if (blank.length > 0) return invalid(`Estes campos não podem ficar vazios: ${blank.join(', ')}.`);

  const update: FarmUpdate = {};
  for (const field of FARM_FIELDS) {
    const value = body[field];
    if (value !== undefined) update[field] = text(value).trim();
  }
  return ok(update);
}

// --- Serviços ---

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

const JOB_SORTS: readonly JobSort[] = ['recent', 'price_desc', 'price_asc', 'duration_asc', 'duration_desc'];

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

  const sort = queryText(query, 'sort');
  if (sort !== undefined) {
    const found = JOB_SORTS.find((s) => s === sort);
    if (!found) return invalid(`sort inválido. Use um destes: ${JOB_SORTS.join(', ')}.`);
    filters.sort = found;
  }

  const workerId = queryText(query, 'worker_id');
  if (workerId !== undefined) {
    const id = Number(workerId);
    if (!Number.isFinite(id) || id <= 0) return invalid('worker_id deve ser um número válido.');
    filters.worker_id = id;
  }
  return ok(filters);
}

// --- Contratação ---

const ANALYZE_ACTIONS: readonly AnalyzeAction[] = ['Accept', 'Reject'];

function isAnalyzeAction(value: unknown): value is AnalyzeAction {
  return ANALYZE_ACTIONS.some((action) => action === value);
}

export function parseAnalyzeInput(body: Body): Result<AnalyzeInput> {
  const { application_id, action } = body;
  if (!isAnalyzeAction(action)) return invalid("A ação deve ser 'Accept' ou 'Reject'.");
  if (!application_id) return invalid('Informe o application_id.');
  return ok({ application_id: Number(application_id), action });
}

export function parseWorkerAction(body: Body): Result<WorkerActionInput> {
  const workerId = body['worker_id'];
  if (!workerId) return invalid('Informe o worker_id.');
  return ok({ worker_id: Number(workerId) });
}
