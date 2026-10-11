import type { MessageResponse } from '#shared/contracts/api';

// Conversa interna de um serviço entre o produtor e o trabalhador aceito. Abre no aceite,
// fecha se o trabalhador desistir e fica aberta por 7 dias depois do pagamento.
// Os números de WhatsApp só aparecem quando os dois liberam.

export type ChatSender = 'farmer' | 'worker' | 'system';

export interface ChatMessage {
  id: number;
  chat_id: number;
  sender: ChatSender; // 'system': aviso da plataforma (aceite, desistência, pagamento, WhatsApp)
  body: string;
  insertion_date: string;
}

export interface ChatPerson {
  name: string;
  photo_url: string | null;
  phone: string | null; // só quando os dois liberaram o WhatsApp
}

export interface Chat {
  id: number;
  service_id: number;
  service_name: string;
  farmer_id: number;
  worker_id: number;
  farmer: ChatPerson;
  worker: ChatPerson;
  farmer_shares_phone: boolean;
  worker_shares_phone: boolean;
  open: boolean; // aceita mensagens
  closes_at: string | null; // quando deixa (deixou) de aceitar mensagens; null enquanto o serviço está em andamento
  unread: number; // mensagens da outra parte (e avisos) que quem pediu ainda não leu
  last_message: ChatMessage | null;
  insertion_date: string;
}

// GET /chats/:id
export interface ChatDetail extends Chat {
  messages: ChatMessage[]; // da mais antiga para a mais nova
}

// POST /chats/:id/messages
export interface ChatMessageInput {
  body: string; // até 1000 caracteres
}

export interface ChatMessageResponse extends MessageResponse {
  sent: ChatMessage;
  masked: boolean; // telefone ou e-mail no texto foi ocultado (os dois ainda não liberaram o WhatsApp)
}

// PATCH /chats/:id/phone
export interface ChatPhoneInput {
  share: boolean;
}

export interface ChatResponse extends MessageResponse {
  chat: Chat;
}
