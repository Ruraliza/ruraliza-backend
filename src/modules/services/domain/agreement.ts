import type { AgreementTerms, PriceUnit } from '../service.contract';

// Valores em inglês na API; a tradução acontece só na UI (e nos avisos da conversa, abaixo).
export const PRICE_UNITS: readonly PriceUnit[] = ['hour', 'day', 'meter', 'hectare', 'fixed'];

export function isPriceUnit(value: unknown): value is PriceUnit {
  return PRICE_UNITS.some((unit) => unit === value);
}

const UNIT_TEXT: Record<PriceUnit, string> = { hour: 'por hora', day: 'por dia', meter: 'por metro', hectare: 'por hectare', fixed: 'pela empreitada' };

export function money(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// "R$ 150,00 por dia" (para os avisos da conversa, das vagas e as notificações).
export function describeTerms(terms: Pick<AgreementTerms, 'amount' | 'unit'>): string {
  return `${money(terms.amount)} ${UNIT_TEXT[terms.unit]}`;
}
