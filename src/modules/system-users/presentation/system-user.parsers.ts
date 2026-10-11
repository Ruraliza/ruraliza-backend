import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, missingMessage } from '#shared/infra/http/body';
import { normalizeEmail } from '#shared/utils/profile';
import { isValidEmail, missingFields, parseNewPassword, text, tooLong } from '#shared/utils/validation';
import type { AdminSystemUserUpdate, SystemUserInput, SystemUserUpdate } from '../system-user.contract';
import { SYSTEM_ROLES } from '../domain/system-user';

// Formato dos corpos das rotas da equipe (400).

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
