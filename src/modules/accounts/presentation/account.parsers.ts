import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, missingMessage } from '#shared/infra/http/body';
import { isValidCpf, missingFields, text } from '#shared/utils/validation';
import { WORKER_TEXTS, optionalText, workerTextProblem } from '../../../http/parsers';
import type { ActiveRoleInput, ProfileCreateInput, UserRole } from '../accounts.contract';

// Formato dos corpos das rotas da conta (400).

const USER_ROLES: readonly UserRole[] = ['farmer', 'worker'];

function parseRole(value: unknown): Result<UserRole> {
  const role = USER_ROLES.find((r) => r === value);
  return role ? ok(role) : invalid("O tipo de perfil (role) deve ser 'farmer' ou 'worker'.");
}

// Segundo perfil: o e-mail e a senha são os da conta, então não vêm aqui.
export function parseProfileCreate(body: Body): Result<ProfileCreateInput> {
  const missing = missingFields(body, ['role', 'name', 'phone', 'cpf']);
  if (missing.length > 0) return invalid(missingMessage(missing));
  if (body['email'] !== undefined || body['password'] !== undefined) {
    return invalid('O e-mail e a senha são os da sua conta e não são enviados aqui.');
  }

  const role = parseRole(body['role']);
  if (!role.ok) return role;
  const cpf = body['cpf'];
  if (!isValidCpf(cpf)) return invalid('CPF inválido. Envie os 11 dígitos, só números, e confira se estão corretos.');

  const profile: ProfileCreateInput = { role: role.value, name: text(body['name']).trim(), phone: text(body['phone']), cpf };
  if (role.value === 'worker') {
    for (const [field] of WORKER_TEXTS) profile[field] = optionalText(body[field]);
    const problem = workerTextProblem(profile);
    if (problem) return invalid(problem);
  }
  return ok(profile);
}

export function parseActiveRole(body: Body): Result<ActiveRoleInput> {
  const missing = missingFields(body, ['role']);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const role = parseRole(body['role']);
  return role.ok ? ok({ role: role.value }) : role;
}
