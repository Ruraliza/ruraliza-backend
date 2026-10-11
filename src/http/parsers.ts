import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, missingMessage } from '#shared/infra/http/body';
import { normalizeEmail } from '#shared/utils/profile';
import { isValidEmail, missingFields, parseNewPassword, text } from '#shared/utils/validation';
import type {
  LoginInput,
  PasswordChangeInput,
  PasswordResetInput,
  PasswordResetRequestInput
} from '../contracts';

// Validação do formato dos corpos (400). Regras que dependem dos dados (unicidade, existência,
// estado do serviço) ficam nos casos de uso.

// --- Acesso ---

export function parseLoginInput(body: Body): Result<LoginInput> {
  const missing = missingFields(body, ['email', 'password']);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const password = body['password'];
  if (typeof password !== 'string') return invalid('A senha deve ser um texto.');
  // Sem validar formato de e-mail nem tamanho da senha: qualquer erro vira "e-mail ou senha incorretos".
  return ok({ email: normalizeEmail(body['email']), password });
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
