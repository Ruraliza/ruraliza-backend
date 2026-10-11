import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import type { ChatMessageRepository, ChatRecord, ChatRepository } from '../domain/chat.repository';

export interface RemoveChatsDeps {
  chats: ChatRepository;
  chatMessages: ChatMessageRepository;
}

// Ao remover um perfil, saem as conversas dele com todas as mensagens.
// TODO(db): ON DELETE CASCADE de chats → chat_messages.
export function chatsCleanup({ chats, chatMessages }: RemoveChatsDeps): ProfileCleanup {
  async function remove(records: ChatRecord[]): Promise<void> {
    for (const chat of records) {
      for (const message of await chatMessages.find({ chat_id: chat.id })) await chatMessages.delete(message.id);
      await chats.delete(chat.id);
    }
  }
  return {
    farmerRemoved: async (farmerId) => remove(await chats.find({ farmer_id: farmerId })),
    workerRemoved: async (workerId) => remove(await chats.find({ worker_id: workerId }))
  };
}
