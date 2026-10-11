import assert from 'node:assert/strict';
import type { Result } from '../domain/result';

// Falha o teste se o resultado não for sucesso; devolve o valor já tipado.
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`esperava sucesso, veio ${result.kind}: ${result.message}`);
  return result.value;
}
