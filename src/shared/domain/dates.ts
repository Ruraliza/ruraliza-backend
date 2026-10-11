// Datas "de calendário" (AAAA-MM-DD) no fuso do Brasil. A validade de um serviço é um dia,
// não um instante: "vale até 30/10" significa até o fim do dia 30 no horário de Brasília.

const TIME_ZONE = 'America/Sao_Paulo';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 'en-CA' formata como AAAA-MM-DD.
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// Dia (AAAA-MM-DD) de um instante ISO, no fuso do Brasil.
export function dayOf(isoInstant: string): string {
  return dayFormatter.format(new Date(isoInstant));
}

// AAAA-MM-DD que existe no calendário (recusa 2026-02-30).
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Vencido quando o dia de hoje (Brasil) já passou do último dia válido.
export function isPastDay(lastDay: string, nowIso: string): boolean {
  return dayOf(nowIso) > lastDay;
}
