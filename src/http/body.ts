import type { ErrorStatus } from './types';

// Corpo JSON já lido, mas ainda não validado: cada campo é `unknown`.
export type Body = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Qualquer corpo que não seja um objeto JSON vira {} (os campos obrigatórios acusam a falta).
export function toBody(value: unknown): Body {
  return isRecord(value) ? value : {};
}

export { text } from '../utils/validation';

// Resultado de uma validação: o valor já tipado, ou o erro HTTP a devolver.
export interface Valid<T> {
  ok: true;
  value: T;
}
export interface Invalid {
  ok: false;
  status: ErrorStatus;
  error: string;
}
export type Result<T> = Valid<T> | Invalid;

export function valid<T>(value: T): Valid<T> {
  return { ok: true, value };
}

export function invalid(status: ErrorStatus, error: string): Invalid {
  return { ok: false, status, error };
}

export function missingMessage(fields: readonly string[]): string {
  return `Preencha os campos obrigatórios: ${fields.join(', ')}.`;
}
