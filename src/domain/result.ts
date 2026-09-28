// Resultado de uma operação de negócio, sem nada de HTTP: quem chama decide o status.
export type FailureKind = 'invalid' | 'not_found' | 'conflict';

export interface Ok<T> {
  ok: true;
  value: T;
}

export interface Failure {
  ok: false;
  kind: FailureKind;
  message: string;
}

export type Result<T> = Ok<T> | Failure;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function invalid(message: string): Failure {
  return { ok: false, kind: 'invalid', message };
}

export function notFound(message: string): Failure {
  return { ok: false, kind: 'not_found', message };
}

export function conflict(message: string): Failure {
  return { ok: false, kind: 'conflict', message };
}

// Para relações que o próprio backend mantém (ex.: serviço → fazenda). Se faltar, é bug: vira 500.
export function requireFound<T>(value: T | undefined, description: string): T {
  if (value === undefined) {
    throw new Error(`Inconsistência nos dados: ${description} não encontrado(a).`);
  }
  return value;
}
