import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../domain/passwords';
import { type Result, invalid, ok } from '../domain/result';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_PATTERN.test(email);
}

// CPF: 11 dígitos (só números), não repetidos, com dígitos verificadores válidos.
export function isValidCpf(cpf: unknown): cpf is string {
  if (typeof cpf !== 'string' || !/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (i: number): number => cpf.charCodeAt(i) - 48; // '0' = 48
  const checkDigit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digit(i) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return checkDigit(9) === digit(9) && checkDigit(10) === digit(10);
}

// 12345678901 -> ***.456.789-**
export function maskCpf(cpf: string): string {
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

// Coordenadas em graus decimais (WGS84), como o Google Maps devolve.
export function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

// Converte um valor do corpo JSON para texto, como a API sempre fez (String(valor)).
export function text(value: unknown): string {
  return String(value);
}

export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || text(value).trim() === '';
}

// Devolve os nomes dos campos obrigatórios ausentes no corpo.
export function missingFields<K extends string>(body: Readonly<Record<string, unknown>>, fields: readonly K[]): K[] {
  return fields.filter((field) => isBlank(body[field]));
}

// Mensagem de erro se o texto passar do limite (null quando está dentro).
export function tooLong(label: string, value: string | null | undefined, max: number): string | null {
  return value && value.length > max ? `${label} pode ter no máximo ${max} caracteres.` : null;
}

// Senha nova, como chegou (sem trim: espaços contam). `label` aparece na mensagem de erro.
export function parseNewPassword(value: unknown, label: string): Result<string> {
  if (typeof value !== 'string') return invalid(`${label} deve ser um texto.`);
  if (value.length < PASSWORD_MIN_LENGTH) return invalid(`${label} precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  if (value.length > PASSWORD_MAX_LENGTH) return invalid(`${label} pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  return ok(value);
}
