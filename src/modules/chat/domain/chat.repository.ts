import type { Repository } from '#shared/domain/repository';
import type { ChatMessage } from '../chat.contract';

// Conversa guardada: o que muda é quem liberou o WhatsApp, até onde cada um leu e quando fecha.
export interface ChatRecord {
  id: number;
  service_id: number;
  farmer_id: number;
  worker_id: number;
  farmer_shares_phone: boolean;
  worker_shares_phone: boolean;
  farmer_read_up_to: number; // id da última mensagem lida pelo produtor (0 = nenhuma)
  worker_read_up_to: number;
  closes_at: string | null;
  insertion_date: string;
}

// Uma conversa por contratação: UNIQUE (service_id, worker_id) na tabela `chats`.
export type ChatRepository = Repository<ChatRecord, 'service_id' | 'farmer_id' | 'worker_id'>;
// Tabela `chat_messages`, com índice (chat_id, id). TODO(db): paginação das mensagens antigas.
export type ChatMessageRepository = Repository<ChatMessage, 'chat_id'>;
