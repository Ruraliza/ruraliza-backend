// API pública do módulo de conversas: o único arquivo que outros módulos enxergam (#modules/chat).
export type * from './chat.contract';
export type { ChatMessageRepository, ChatRecord, ChatRepository } from './domain/chat.repository';
export { HIRED_MESSAGE } from './application/chat-hiring-events';
export { createInMemoryChatMessageRepository, createInMemoryChatRepository } from './infra/in-memory-chat.repositories';
export type { ChatRoutes } from './presentation/chat.routes';
export { type ChatSchemaName, chatSchemas } from './presentation/chat.schemas';
export { type ChatModuleDeps, type ChatUseCases, createChatRoutes, createChatUseCases } from './chat.module';
