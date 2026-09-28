import type { FarmerInput, FarmerUpdate } from '../contracts';
import { type Body, type Result, invalid, missingMessage, text, valid } from '../http/body';
import { isValidCpf, isValidEmail, maskCpf, missingFields } from './validation';

// Campos comuns aos dois perfis (Farmer e Worker) usados na unicidade.
interface Profile {
  id: number;
  email: string;
  cpf: string;
}

// Dados comuns de cadastro/edição dos dois perfis (o trabalhador tem campos a mais).
export type ProfileInput = FarmerInput;
export type ProfileUpdate = FarmerUpdate;

const REQUIRED_PROFILE_FIELDS = ['email', 'name', 'phone', 'cpf'] as const;

// Valida os dados de cadastro de um perfil (Farmer ou Worker).
// `existingProfiles` é a lista do MESMO tipo de perfil (unicidade por tipo).
export function parseProfileInput(body: Body, existingProfiles: readonly Profile[]): Result<ProfileInput> {
  const missing = missingFields(body, REQUIRED_PROFILE_FIELDS);
  if (missing.length > 0) {
    return invalid(400, missingMessage(missing));
  }

  const email = normalizeEmail(body['email']);
  if (!isValidEmail(email)) {
    return invalid(400, 'E-mail inválido. Use o formato nome@dominio.com.');
  }

  const cpf = body['cpf'];
  if (!isValidCpf(cpf)) {
    return invalid(400, 'CPF inválido. Envie os 11 dígitos, só números, e confira se estão corretos.');
  }

  // TODO(db): trocar por restrições UNIQUE (email) e (cpf) na tabela de cada perfil.
  if (existingProfiles.some((p) => p.email === email)) {
    return invalid(409, 'Já existe um cadastro com este e-mail.');
  }
  if (existingProfiles.some((p) => p.cpf === cpf)) {
    return invalid(409, 'Já existe um cadastro com este CPF.');
  }

  return valid({ email, name: text(body['name']).trim(), phone: text(body['phone']), cpf });
}

// Valida os dados de edição de um perfil (Farmer ou Worker).
// `existingProfiles` é a lista do MESMO tipo de perfil, `currentId` é o id do perfil sendo editado.
// Só os campos enviados aparecem no resultado.
export function parseProfileUpdate(body: Body, existingProfiles: readonly Profile[], currentId: number): Result<ProfileUpdate> {
  if (body['id'] !== undefined || body['cpf'] !== undefined) {
    return invalid(400, 'Não é permitido alterar o id ou o cpf.');
  }

  const update: ProfileUpdate = {};

  if (body['email'] !== undefined) {
    const email = normalizeEmail(body['email']);
    if (!isValidEmail(email)) {
      return invalid(400, 'E-mail inválido. Use o formato nome@dominio.com.');
    }
    // TODO(db): trocar por restrição UNIQUE (email) na tabela de cada perfil.
    if (existingProfiles.some((p) => p.id !== currentId && p.email === email)) {
      return invalid(409, 'Já existe um cadastro com este e-mail.');
    }
    update.email = email;
  }
  if (body['name'] !== undefined) update.name = text(body['name']).trim();
  if (body['phone'] !== undefined) update.phone = text(body['phone']);

  return valid(update);
}

export function normalizeEmail(email: unknown): string {
  return text(email).trim().toLowerCase();
}

// Versão do perfil segura para listas e respostas embutidas (CPF mascarado).
export function toPublicProfile<T extends { cpf: string }>(profile: T): T {
  return { ...profile, cpf: maskCpf(profile.cpf) };
}
