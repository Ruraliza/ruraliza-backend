// Avisos por WhatsApp (issue #30). Só saem para quem ligou "Avisos no WhatsApp" nas preferências
// da conta e só quando a integração está configurada no .env (ver infra/evolution-whatsapp-sender.ts).
export interface WhatsAppSender {
  readonly enabled: boolean;
  // `phone`: número internacional só com dígitos (ex.: 5524999998888).
  send(phone: string, text: string): Promise<void>;
}

// Integração desligada (padrão sem as variáveis do .env): nada é enviado.
export const DISABLED_WHATSAPP: WhatsAppSender = { enabled: false, send: () => Promise.resolve() };

// Telefone do cadastro (DDD + número, só dígitos) no formato do WhatsApp: DDI 55 + DDD + número.
// Só celular (11 dígitos, começando com 9 depois do DDD): fixo não tem WhatsApp. null = não dá para enviar.
export function whatsappNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const national = digits.length === 13 && digits.startsWith('55') ? digits.slice(2) : digits;
  return /^[1-9]{2}9\d{8}$/.test(national) ? `55${national}` : null;
}
