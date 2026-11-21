import type { AccessPolicies } from '#modules/auth';
import type { FarmerRepository } from '#modules/farmers';
import type { ApplicationRepository, HiringEvents, NegotiationChats, ProposalRepository } from '#modules/hiring';
import type { PushNotifier } from '#modules/notifications';
import type { JobEvents, ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import { chatHiringEvents, negotiationChats } from './application/chat-hiring-events';
import { GetChatUseCase } from './application/get-chat.usecase';
import { ListChatsUseCase } from './application/list-chats.usecase';
import { MarkChatReadUseCase } from './application/mark-chat-read.usecase';
import { OpenChatUseCase } from './application/open-chat.usecase';
import { chatsCleanup } from './application/remove-chats';
import { SendMessageUseCase } from './application/send-message.usecase';
import { SharePhoneUseCase } from './application/share-phone.usecase';
import type { ChatMessageRepository, ChatRepository } from './domain/chat.repository';
import { createChatController } from './presentation/chat.controller';
import { type ChatRoutes, chatRoutes } from './presentation/chat.routes';

export interface ChatModuleDeps {
  chats: ChatRepository;
  chatMessages: ChatMessageRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  proposals: ProposalRepository;
  farmers: FarmerRepository;
  workers: WorkerRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

export interface ChatUseCases {
  listChats: ListChatsUseCase;
  openChat: OpenChatUseCase;
  getChat: GetChatUseCase;
  sendMessage: SendMessageUseCase;
  markChatRead: MarkChatReadUseCase;
  sharePhone: SharePhoneUseCase;
  // Fecha/reabre a conversa junto com a contratação e o cancelamento da vaga (ligado nos módulos hiring e services pelo container).
  hiringEvents: HiringEvents & Pick<JobEvents, 'jobCancelled'>;
  // A conversa em que as propostas são feitas (lida pelo módulo hiring).
  negotiationChats: NegotiationChats;
  // Apaga as conversas de um perfil removido.
  cleanup: ProfileCleanup;
}

// Casos de uso das conversas (montados pelo container).
export function createChatUseCases(deps: ChatModuleDeps): ChatUseCases {
  return {
    listChats: new ListChatsUseCase(deps),
    openChat: new OpenChatUseCase(deps),
    getChat: new GetChatUseCase(deps),
    sendMessage: new SendMessageUseCase(deps),
    markChatRead: new MarkChatReadUseCase(deps),
    sharePhone: new SharePhoneUseCase(deps),
    hiringEvents: chatHiringEvents(deps),
    negotiationChats: negotiationChats(deps),
    cleanup: chatsCleanup(deps)
  };
}

// Rotas HTTP (listas em /api/farmers e /api/workers, a conversa em /api/chats).
export function createChatRoutes(useCases: ChatUseCases, access: AccessPolicies): ChatRoutes {
  return chatRoutes(createChatController(useCases), access);
}
