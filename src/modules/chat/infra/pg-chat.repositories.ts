import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { ChatMessageRepository, ChatRepository } from '../domain/chat.repository';

export function createPgChatRepository(db: Database): ChatRepository {
  return new PgRepository(db, 'chats', {
    service_id: 'value', farmer_id: 'value', worker_id: 'value', farmer_shares_phone: 'value', worker_shares_phone: 'value',
    farmer_read_up_to: 'value', worker_read_up_to: 'value', closes_at: 'value', insertion_date: 'value'
  }, ['service_id', 'farmer_id', 'worker_id']);
}

export function createPgChatMessageRepository(db: Database): ChatMessageRepository {
  return new PgRepository(db, 'chat_messages', {
    chat_id: 'value', sender: 'value', body: 'value', insertion_date: 'value'
  }, ['chat_id']);
}
