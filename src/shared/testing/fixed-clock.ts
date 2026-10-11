import type { Clock } from '../domain/clock';

// Relógio parado num instante (ISO 8601), para as datas dos testes serem previsíveis.
export function fixedClock(now: string): Clock {
  return { now: () => now };
}
