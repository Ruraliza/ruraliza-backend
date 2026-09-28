import type { Response } from 'express';
import type { ApiError } from '../contracts';
import type { Failure, FailureKind } from '../domain/result';
import type { ErrorStatus } from './types';

// Tradução dos erros de negócio para HTTP.
const STATUS: Record<FailureKind, ErrorStatus> = {
  invalid: 400,
  not_found: 404,
  conflict: 409
};

export function sendFailure<Res>(res: Response<Res | ApiError, Record<string, never>>, failure: Failure): void {
  res.status(STATUS[failure.kind]).json({ error: failure.message });
}

// Id vindo da URL/corpo; um id inválido (NaN) simplesmente não encontra nada.
export function toId(value: unknown): number {
  return Number(value);
}
