import type {
  AnalyzeAction,
  AnalyzeInput,
  FarmInput,
  FarmUpdate,
  FarmerInput,
  FarmerUpdate,
  ServiceInput,
  ServiceUpdate,
  WorkerActionInput,
  WorkerUpdate
} from '../contracts';
import { type Result, invalid, ok } from '../domain/result';
import type { NewWorker } from '../usecases/WorkerUseCases';
import { normalizeEmail } from '../utils/profile';
import { isPositiveNumber, isValidCpf, isValidEmail, missingFields, text } from '../utils/validation';
import { type Body, missingMessage } from './body';

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

export function parseWorkerInput(body: Body): Result<NewWorker> {
  const profile = parseProfileInput(body);
  if (!profile.ok) return profile;
  return ok({
    ...profile.value,
    certificates: optionalText(body['certificates']),
    experience: optionalText(body['experience'])
  });
}

export function parseWorkerUpdate(body: Body): Result<WorkerUpdate> {
  const profile = parseProfileUpdate(body);
  if (!profile.ok) return profile;

  const update: WorkerUpdate = { ...profile.value };
  if (body['certificates'] !== undefined) update.certificates = nullableText(body['certificates']);
  if (body['experience'] !== undefined) update.experience = nullableText(body['experience']);
  return ok(update);
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

  return ok({
    farmer_id: Number(body['farmer_id']),
    farm_id: Number(body['farm_id']),
    name: text(body['name']).trim(),
    category: text(body['category']),
    duration,
    price
  });
}

export function parseServiceUpdate(body: Body): Result<ServiceUpdate> {
  const locked = [body['farmer_id'], body['worker_id'], body['payment_id'], body['status']];
  if (locked.some((v) => v !== undefined)) {
    return invalid('Só é possível alterar fazenda, nome, categoria, duração e valor.');
  }

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
  return ok(update);
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
