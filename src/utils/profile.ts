import { maskCpf, text } from './validation';

export function normalizeEmail(email: unknown): string {
  return text(email).trim().toLowerCase();
}

// Versão do perfil segura para listas e respostas embutidas (CPF mascarado).
export function toPublicProfile<T extends { cpf: string }>(profile: T): T {
  return { ...profile, cpf: maskCpf(profile.cpf) };
}
