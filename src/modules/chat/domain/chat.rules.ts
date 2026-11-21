import { SERVICE_STATUS, type Service } from '#modules/services';
import type { ChatRecord } from './chat.repository';

export const MAX_CHAT_MESSAGE = 1000;
// Depois do pagamento, a conversa continua aberta por estes dias (para acertar algum detalhe).
export const CHAT_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ChatSide = 'farmer' | 'worker';

// Quem está olhando: os perfis da conta que fez a requisição.
export interface ChatViewer {
  farmerId: number | null;
  workerId: number | null;
}

// Qual lado da conversa é o visitante (uma conta não tem os dois lados: ninguém se candidata ao próprio serviço).
export function sideOf(chat: ChatRecord, viewer: ChatViewer): ChatSide | null {
  if (viewer.farmerId !== null && chat.farmer_id === viewer.farmerId) return 'farmer';
  if (viewer.workerId !== null && chat.worker_id === viewer.workerId) return 'worker';
  return null;
}

export function otherSide(side: ChatSide): ChatSide {
  return side === 'farmer' ? 'worker' : 'farmer';
}

export function isOpen(chat: ChatRecord, now: string): boolean {
  return chat.closes_at === null || Date.parse(now) < Date.parse(chat.closes_at);
}

export function graceEnd(paidAt: string): string {
  return new Date(Date.parse(paidAt) + CHAT_GRACE_DAYS * DAY_MS).toISOString();
}

// O trabalhador da conversa foi aceito no serviço (em andamento ou concluído): só então o WhatsApp pode ser liberado.
export function isHired(chat: ChatRecord, service: Pick<Service, 'status' | 'worker_id'>): boolean {
  return service.worker_id === chat.worker_id && (service.status === SERVICE_STATUS.IN_PROGRESS || service.status === SERVICE_STATUS.COMPLETED);
}

export function bothSharePhone(chat: ChatRecord): boolean {
  return chat.farmer_shares_phone && chat.worker_shares_phone;
}

// Telefone e e-mail no texto saem ocultos até os dois liberarem o WhatsApp (src/shared/domain/contacts.ts).
export { HIDDEN_EMAIL, HIDDEN_PHONE, maskContacts } from '#shared/domain/contacts';

// "Maria da Silva" -> "Maria"
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
