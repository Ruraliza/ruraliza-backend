import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { ChatMessageRepository, ChatRepository } from '../domain/chat.repository';

export function createInMemoryChatRepository(): ChatRepository {
  return new InMemoryRepository(['service_id', 'farmer_id', 'worker_id'], (data, id) => ({ id, ...data }));
}

export function createInMemoryChatMessageRepository(): ChatMessageRepository {
  return new InMemoryRepository(['chat_id'], (data, id) => ({ id, ...data }));
}
