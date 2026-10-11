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

export function bothSharePhone(chat: ChatRecord): boolean {
  return chat.farmer_shares_phone && chat.worker_shares_phone;
}

// Sequência de 8 a 13 dígitos (com espaços, pontos, traços, parênteses ou +): telefone, com ou sem DDD/DDI.
// "R$ 1.500,00", "12/10" e "7h" não chegam a 8 dígitos seguidos.
const PHONE_LIKE = /\+?\(?\d[\d\s().-]{6,}\d/g;
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
export const HIDDEN_PHONE = '[número oculto]';
export const HIDDEN_EMAIL = '[e-mail oculto]';

// Enquanto os dois não liberam o WhatsApp, telefone e e-mail digitados no texto saem ocultos:
// o contato só é trocado com o consentimento dos dois.
export function maskContacts(text: string): { text: string; masked: boolean } {
  let masked = false;
  const withoutEmails = text.replace(EMAIL_LIKE, () => {
    masked = true;
    return HIDDEN_EMAIL;
  });
  const result = withoutEmails.replace(PHONE_LIKE, (match) => {
    const digits = match.replace(/\D/g, '').length;
    if (digits < 8 || digits > 13) return match;
    masked = true;
    return HIDDEN_PHONE;
  });
  return { text: result, masked };
}

// "Maria da Silva" -> "Maria"
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
