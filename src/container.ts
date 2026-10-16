import { type AccountUseCases, type ProfileFactory, createAccountUseCases } from '#modules/accounts';
import { type AdminUseCases, createAdminUseCases } from '#modules/admin';
import { type ChatUseCases, createChatUseCases } from '#modules/chat';
import { type AuthUseCases, createAuthUseCases } from '#modules/auth';
import { type FarmerUseCases, createFarmerUseCases } from '#modules/farmers';
import { type FarmUseCases, createFarmUseCases } from '#modules/farms';
import { type HelpUseCases, createHelpUseCases } from '#modules/help';
import { type HiringUseCases, createHiringUseCases } from '#modules/hiring';
import { type PhotoUseCases, createPhotoUseCases } from '#modules/media';
import {
  DISABLED_WHATSAPP,
  EvolutionWhatsAppSender,
  type NotificationUseCases,
  type PushDispatcher,
  type PushSender,
  type PushUseCases,
  WebPushSender,
  type WhatsAppSender,
  createNotificationUseCases,
  createPushDispatcher,
  createPushUseCases
} from '#modules/notifications';
import { type ReviewUseCases, createReviewUseCases } from '#modules/reviews';
import { type ServiceUseCases, createServiceUseCases } from '#modules/services';
import { type SystemUserUseCases, createSystemUserUseCases } from '#modules/system-users';
import { type CertificateCodes, type TrackUseCases, createTrackUseCases, randomCertificateCodes } from '#modules/tracks';
import { type WorkerUseCases, createWorkerUseCases } from '#modules/workers';
import { authTokenSecret, whatsAppSettings } from '#shared/config';
import type { ChangeFeed } from '#shared/domain/changes';
import { type Clock, systemClock } from '#shared/domain/clock';
import type { DocumentStore } from '#shared/domain/documents';
import type { ImageProcessor, ImageStore } from '#shared/domain/images';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import type { ResetTokens, SessionTokens } from '#shared/domain/tokens';
import { createHmacSessionTokens, randomResetTokens, scryptPasswordHasher } from '#shared/infra/crypto/node-crypto';
import { InMemoryDocumentStore } from '#shared/infra/documents/in-memory-document-store';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import { SharpImageProcessor } from '#shared/infra/images/sharp-image-processor';
import { InMemoryChangeFeed } from '#shared/infra/memory/in-memory-change-feed';
import type { Repositories } from './repositories';
import { createInMemoryRepositories } from './repositories';

// Raiz de composição: o único lugar que escolhe as implementações concretas.
// Para trocar a persistência (ex.: PostgreSQL), passe outros `repos` aqui; para guardar as
// fotos fora da memória (ex.: S3/R2 ou disco), passe outro `images` (ver src/domain/images.ts);
// para os currículos em PDF, outro `documents` (ver src/domain/documents.ts).
// As senhas usam scrypt (`passwords`); os testes podem passar um hasher mais rápido.
// Os avisos de mudança para as telas abertas (`changes`, por SSE) ficam em memória;
// as notificações push saem pelo `push` (Web Push com as chaves VAPID do .env; os testes passam um falso),
// ficam guardadas na central de notificações de cada perfil e, para quem pediu, saem também no WhatsApp
// (`whatsapp`: Evolution API, ligada pelas variáveis WHATSAPP_* do .env; sem elas, desligada).
// Os tokens de sessão (`tokens`) são assinados com AUTH_TOKEN_SECRET; os códigos dos certificados
// (`certificateCodes`) são aleatórios, e os testes podem passar um gerador previsível.

export interface UseCases {
  auth: AuthUseCases;
  accounts: AccountUseCases;
  farmers: FarmerUseCases;
  workers: WorkerUseCases;
  farms: FarmUseCases;
  services: ServiceUseCases;
  hiring: HiringUseCases;
  reviews: ReviewUseCases;
  chat: ChatUseCases;
  photos: PhotoUseCases;
  push: PushUseCases;
  notifications: NotificationUseCases;
  systemUsers: SystemUserUseCases;
  admin: AdminUseCases;
  tracks: TrackUseCases;
  help: HelpUseCases;
}

export interface Container {
  repos: Repositories;
  images: ImageStore;
  documents: DocumentStore;
  passwords: PasswordHasher;
  clock: Clock;
  changes: ChangeFeed;
  tokens: SessionTokens;
  // Envia os pushes dos casos de uso; `idle()` espera os envios em andamento (testes).
  notifier: PushDispatcher;
  useCases: UseCases;
}

export interface ContainerOptions {
  repos?: Repositories;
  images?: ImageStore;
  documents?: DocumentStore;
  imageProcessor?: ImageProcessor;
  passwords?: PasswordHasher;
  resetTokens?: ResetTokens;
  clock?: Clock;
  changes?: ChangeFeed;
  push?: PushSender;
  whatsapp?: WhatsAppSender;
  tokens?: SessionTokens;
  certificateCodes?: CertificateCodes;
}

export function createContainer(options: ContainerOptions = {}): Container {
  const repos = options.repos ?? createInMemoryRepositories();
  const images = options.images ?? new InMemoryImageStore();
  const documents = options.documents ?? new InMemoryDocumentStore();
  const imageProcessor = options.imageProcessor ?? new SharpImageProcessor();
  const passwords = options.passwords ?? scryptPasswordHasher;
  const resetTokens = options.resetTokens ?? randomResetTokens;
  const clock = options.clock ?? systemClock;
  const changes = options.changes ?? new InMemoryChangeFeed();
  const tokens = options.tokens ?? createHmacSessionTokens(authTokenSecret(), clock);
  const { farmers, workers, farms, services, applications, payments, accounts, pushSubscriptions, notifications, systemUsers, workerReviews, farmReviews, chats, chatMessages, tracks, enrollments, certificates } = repos;
  const whatsAppConfig = whatsAppSettings();
  const whatsapp = options.whatsapp ?? (whatsAppConfig ? new EvolutionWhatsAppSender(whatsAppConfig) : DISABLED_WHATSAPP);
  // Telefone do perfil para o WhatsApp (o módulo de notificações não conhece produtores e trabalhadores).
  const phoneOf = async (role: 'farmer' | 'worker', profileId: number): Promise<string | null> =>
    (await (role === 'farmer' ? farmers.findById(profileId) : workers.findById(profileId)))?.phone ?? null;
  const pushDeps = { accounts, pushSubscriptions, notifications, changes, clock, sender: options.push ?? new WebPushSender(), whatsapp, phoneOf };
  const notificationUseCases = createNotificationUseCases({ notifications, changes });
  const notifier = createPushDispatcher(pushDeps);
  // Avaliações e conversas vêm antes: a contratação e as vagas leem a reputação, a contratação abre
  // e fecha a conversa, e a remoção de um perfil apaga as conversas e as avaliações dele.
  const reviewUseCases = createReviewUseCases({ services, payments, farms, workers, workerReviews, farmReviews, clock, changes, push: notifier });
  const chatUseCases = createChatUseCases({ chats, chatMessages, services, farmers, workers, clock, changes, push: notifier });
  const cleanup: ProfileCleanup = {
    farmerRemoved: async (id) => {
      await chatUseCases.cleanup.farmerRemoved(id);
      await reviewUseCases.cleanup.farmerRemoved(id);
      await notificationUseCases.removeFor('farmer', id);
    },
    workerRemoved: async (id) => {
      await chatUseCases.cleanup.workerRemoved(id);
      await reviewUseCases.cleanup.workerRemoved(id);
      await notificationUseCases.removeFor('worker', id);
    }
  };
  const reputation = reviewUseCases.getReputation;
  const farmerUseCases = createFarmerUseCases({ farmers, workers, farms, services, applications, accounts, pushSubscriptions, clock, images, passwords, changes, cleanup });
  const workerUseCases = createWorkerUseCases({ workers, farmers, farms, services, applications, accounts, pushSubscriptions, clock, images, documents, passwords, changes, cleanup });
  // O segundo perfil de uma conta (src/modules/accounts) é criado pelos casos de uso dos perfis.
  const profiles: ProfileFactory = {
    create: (role, { bio, certificates, courses, experience, ...base }) => role === 'farmer'
      ? farmerUseCases.createFarmerProfile.execute(base)
      : workerUseCases.createWorkerProfile.execute({ ...base, bio, certificates, courses, experience })
  };

  return {
    repos,
    images,
    documents,
    passwords,
    clock,
    changes,
    tokens,
    notifier,
    useCases: {
      auth: createAuthUseCases({ accounts, farmers, workers, clock, passwords, resetTokens }),
      accounts: createAccountUseCases({ accounts, farmers, workers, profiles }),
      farmers: farmerUseCases,
      workers: workerUseCases,
      farms: createFarmUseCases({ farmers, farms, services, clock }),
      services: createServiceUseCases({ farmers, farms, services, applications, clock, changes, push: notifier, reputation }),
      hiring: createHiringUseCases({ services, applications, payments, workers, accounts, clock, changes, push: notifier, events: chatUseCases.hiringEvents, reputation }),
      reviews: reviewUseCases,
      chat: chatUseCases,
      photos: createPhotoUseCases({ farmers, workers, farms, images: { processor: imageProcessor, store: images } }),
      push: createPushUseCases(pushDeps),
      notifications: notificationUseCases,
      systemUsers: createSystemUserUseCases({ systemUsers, clock, passwords }),
      admin: createAdminUseCases({ accounts, farmers, workers, services, farmerUseCases, workerUseCases }),
      help: createHelpUseCases({ helpArticles: repos.helpArticles, clock }),
      tracks: createTrackUseCases({ tracks, enrollments, certificates, workers, systemUsers, clock, codes: options.certificateCodes ?? randomCertificateCodes })
    }
  };
}
