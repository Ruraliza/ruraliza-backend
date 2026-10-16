import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, missingMessage } from '#shared/infra/http/body';
import { normalizeEmail } from '#shared/utils/profile';
import { isValidCpf, isValidEmail, missingFields, parseNewPassword, text, tooLong } from '#shared/utils/validation';
import { blockedTermProblem } from '#shared/domain/moderation';
import { TERMS_REQUIRED } from '../domain/terms';

// Peças dos parsers de perfil (produtor e trabalhador), usadas também pelo segundo perfil da conta.

// Limites de tamanho dos textos livres (evita perfis e anúncios gigantes).
const MAX_BIO = 500;
const MAX_LONG_TEXT = 1000;

// Campos comuns do cadastro de um perfil (o de produtor é exatamente isto).
export interface ProfileFields {
  email: string;
  name: string;
  phone: string;
  cpf: string;
  password: string;
}

export type ProfileChanges = Partial<Pick<ProfileFields, 'email' | 'name' | 'phone'>>;

const REQUIRED_PROFILE_FIELDS = ['email', 'name', 'phone', 'cpf', 'password'] as const;

export function parseProfileInput(body: Body): Result<ProfileFields> {
  const missing = missingFields(body, REQUIRED_PROFILE_FIELDS);
  if (missing.length > 0) return invalid(missingMessage(missing));

  const email = normalizeEmail(body['email']);
  if (!isValidEmail(email)) return invalid('E-mail inválido. Use o formato nome@dominio.com.');

  const cpf = body['cpf'];
  if (!isValidCpf(cpf)) return invalid('CPF inválido. Envie os 11 dígitos, só números, e confira se estão corretos.');

  const password = parseNewPassword(body['password'], 'A senha');
  if (!password.ok) return password;

  // Sem o aceite dos termos, não há conta (o caso de uso grava a data e a versão aceitas).
  if (body['accept_terms'] !== true) return invalid(TERMS_REQUIRED);

  return ok({ email, name: text(body['name']).trim(), phone: text(body['phone']), cpf, password: password.value });
}

// Só os campos enviados aparecem no resultado.
export function parseProfileUpdate(body: Body): Result<ProfileChanges> {
  if (body['id'] !== undefined || body['cpf'] !== undefined) {
    return invalid('Não é permitido alterar o id ou o cpf.');
  }
  if (body['password'] !== undefined) {
    return invalid('A senha não muda por aqui. Use PATCH /:id/password, com a senha atual.');
  }

  const update: ProfileChanges = {};
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
export function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

export const WORKER_TEXTS = [
  ['bio', 'A apresentação', MAX_BIO],
  ['certificates', 'Certificados', MAX_LONG_TEXT],
  ['courses', 'Cursos', MAX_LONG_TEXT],
  ['experience', 'Experiência', MAX_LONG_TEXT]
] as const;

// Onde está o problema, para a mensagem do filtro de palavrões.
const WORKER_TEXT_WHERE = { bio: 'na apresentação', certificates: 'nos certificados', courses: 'nos cursos', experience: 'na experiência' } as const;

export function workerTextProblem(values: Partial<Record<(typeof WORKER_TEXTS)[number][0], string | null>>): string | null {
  for (const [field, label, max] of WORKER_TEXTS) {
    const problem = tooLong(label, values[field], max) ?? blockedTermProblem(WORKER_TEXT_WHERE[field], values[field]);
    if (problem) return problem;
  }
  return null;
}
