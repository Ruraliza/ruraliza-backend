import type {
  AdminSystemUserUpdate,
  LoginInput,
  FarmerInput,
  FarmerUpdate,
  PasswordChangeInput,
  PasswordResetInput,
  PasswordResetRequestInput,
  SystemUserInput,
  SystemUserUpdate,
  WorkerUpdate
} from '../contracts';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '#shared/domain/passwords';
import { SYSTEM_ROLES } from '../domain/system-users';
import { type Result, invalid, ok } from '#shared/domain/result';
import type { NewWorker } from '../usecases/WorkerUseCases';
import { normalizeEmail } from '#shared/utils/profile';
import { isValidCpf, isValidEmail, missingFields, text, tooLong } from '#shared/utils/validation';
import { type Body, missingMessage } from '#shared/infra/http/body';

// Limites de tamanho dos textos livres (evita perfis e anúncios gigantes).
const MAX_BIO = 500;
const MAX_LONG_TEXT = 1000;

// Validação do formato dos corpos (400). Regras que dependem dos dados (unicidade, existência,
// estado do serviço) ficam nos casos de uso.

// --- Senhas ---

// Senha nova, como chegou (sem trim: espaços contam). `label` aparece na mensagem de erro.
function parseNewPassword(value: unknown, label: string): Result<string> {
  if (typeof value !== 'string') return invalid(`${label} deve ser um texto.`);
  if (value.length < PASSWORD_MIN_LENGTH) return invalid(`${label} precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  if (value.length > PASSWORD_MAX_LENGTH) return invalid(`${label} pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  return ok(value);
}

// --- Perfis ---

const REQUIRED_PROFILE_FIELDS = ['email', 'name', 'phone', 'cpf', 'password'] as const;

export function parseProfileInput(body: Body): Result<FarmerInput> {
  const missing = missingFields(body, REQUIRED_PROFILE_FIELDS);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const email = normalizeEmail(body['email']);
  if (!isValidEmail(email)) return invalid('E-mail inválido. Use o formato nome@dominio.com.');

  const cpf = body['cpf'];
  if (!isValidCpf(cpf)) return invalid('CPF inválido. Envie os 11 dígitos, só números, e confira se estão corretos.');

  const password = parseNewPassword(body['password'], 'A senha');
  if (!password.ok) return password;

  return ok({ email, name: text(body['name']).trim(), phone: text(body['phone']), cpf, password: password.value });
}

// Só os campos enviados aparecem no resultado.
export function parseProfileUpdate(body: Body): Result<FarmerUpdate> {
  if (body['id'] !== undefined || body['cpf'] !== undefined) {
    return invalid('Não é permitido alterar o id ou o cpf.');
  }
  if (body['password'] !== undefined) {
    return invalid('A senha não muda por aqui. Use PATCH /:id/password, com a senha atual.');
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
export function optionalText(value: unknown): string | null {
  return value ? text(value) : null;
}

// Na edição, null limpa o campo; qualquer outro valor é guardado como texto.
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

export const WORKER_TEXTS = [
  ['bio', 'A apresentação', MAX_BIO],
  ['certificates', 'Certificados', MAX_LONG_TEXT],
  ['courses', 'Cursos', MAX_LONG_TEXT],
  ['experience', 'Experiência', MAX_LONG_TEXT]
] as const;

export function workerTextProblem(values: Partial<Record<(typeof WORKER_TEXTS)[number][0], string | null>>): string | null {
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

// --- Acesso ---

export function parseLoginInput(body: Body): Result<LoginInput> {
  const missing = missingFields(body, ['email', 'password']);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const password = body['password'];
  if (typeof password !== 'string') return invalid('A senha deve ser um texto.');
  // Sem validar formato de e-mail nem tamanho da senha: qualquer erro vira "e-mail ou senha incorretos".
  return ok({ email: normalizeEmail(body['email']), password });
}

// --- Usuários de sistema ---

const MAX_NAME = 120;

export function parseSystemUserInput(body: Body): Result<SystemUserInput> {
  const missing = missingFields(body, ['email', 'name', 'role', 'password']);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const email = normalizeEmail(body['email']);
  if (!isValidEmail(email)) return invalid('E-mail inválido. Use o formato nome@dominio.com.');

  const name = text(body['name']).trim();
  if (!name) return invalid('Informe o nome.');
  const longName = tooLong('O nome', name, MAX_NAME);
  if (longName) return invalid(longName);

  const role = SYSTEM_ROLES.find((r) => r === body['role']);
  if (!role) return invalid("O cargo (role) deve ser 'admin' ou 'tutor'.");

  const password = parseNewPassword(body['password'], 'A senha');
  if (!password.ok) return password;

  return ok({ email, name, role, password: password.value });
}

// Edição parcial de usuário de sistema: só os campos enviados aparecem no resultado.
// `role` só vale quando `allowRole` (edição pelo administrador).
function parseSystemUserChanges(body: Body, allowRole: boolean): Result<AdminSystemUserUpdate> {
  if (body['id'] !== undefined) return invalid('Não é permitido alterar o id.');
  if (body['password'] !== undefined) return invalid('A senha não muda por aqui.');
  if (body['role'] !== undefined && !allowRole) return invalid('O cargo só pode ser alterado por um administrador.');

  const update: AdminSystemUserUpdate = {};
  if (body['email'] !== undefined) {
    const email = normalizeEmail(body['email']);
    if (!isValidEmail(email)) return invalid('E-mail inválido. Use o formato nome@dominio.com.');
    update.email = email;
  }
  if (body['name'] !== undefined) {
    const name = text(body['name']).trim();
    if (!name) return invalid('Informe o nome.');
    const longName = tooLong('O nome', name, MAX_NAME);
    if (longName) return invalid(longName);
    update.name = name;
  }
  if (body['role'] !== undefined) {
    const role = SYSTEM_ROLES.find((r) => r === body['role']);
    if (!role) return invalid("O cargo (role) deve ser 'admin' ou 'tutor'.");
    update.role = role;
  }
  return ok(update);
}

export function parseSystemUserUpdate(body: Body): Result<SystemUserUpdate> {
  return parseSystemUserChanges(body, false);
}

export function parseAdminSystemUserUpdate(body: Body): Result<AdminSystemUserUpdate> {
  return parseSystemUserChanges(body, true);
}

export function parsePasswordResetRequest(body: Body): Result<PasswordResetRequestInput> {
  const missing = missingFields(body, ['email']);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const email = normalizeEmail(body['email']);
  if (!isValidEmail(email)) return invalid('E-mail inválido. Use o formato nome@dominio.com.');
  return ok({ email });
}

export function parsePasswordReset(body: Body): Result<PasswordResetInput> {
  const missing = missingFields(body, ['token', 'password']);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const password = parseNewPassword(body['password'], 'A nova senha');
  if (!password.ok) return password;
  return ok({ token: text(body['token']), password: password.value });
}

export function parsePasswordChange(body: Body): Result<PasswordChangeInput> {
  const missing = missingFields(body, ['current_password', 'new_password']);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const current = body['current_password'];
  if (typeof current !== 'string') return invalid('A senha atual deve ser um texto.');
  const next = parseNewPassword(body['new_password'], 'A nova senha');
  if (!next.ok) return next;
  return ok({ current_password: current, new_password: next.value });
}
