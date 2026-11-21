// Contato digitado no texto (conversa, candidatura, proposta): o telefone e o e-mail só são trocados
// com o consentimento dos dois, quando liberam o WhatsApp depois do aceite.

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
