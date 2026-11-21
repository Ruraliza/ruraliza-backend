import { type AccountUseCases, type ProfileFactory, createAccountUseCases } from '#modules/accounts';
import { type AdminUseCases, createAdminUseCases } from '#modules/admin';
import { type ChatUseCases, createChatUseCases } from '#modules/chat';
import { type AuthUseCases, type ResetCodeDelivery, createAuthUseCases } from '#modules/auth';
import { type FarmerUseCases, createFarmerUseCases } from '#modules/farmers';
import { type FarmUseCases, createFarmUseCases } from '#modules/farms';
import { type FarmStatsUseCases, createFarmStatsUseCases } from '#modules/farm-stats';
import { type HelpUseCases, createHelpUseCases } from '#modules/help';
import { type HiringUseCases, createHiringUseCases, servicePaymentReader } from '#modules/hiring';
import { type MatchingUseCases, createMatchingUseCases } from '#modules/matching';
import { type PhotoUseCases, createPhotoUseCases } from '#modules/media';
import {
  type NotificationUseCases,
  type PushDispatcher,
  type PushSender,
  type PushUseCases,
  WebPushSender,
  createNotificationUseCases,
  createPushDispatcher,
  createPushUseCases
} from '#modules/notifications';
import { type ReportUseCases, createReportUseCases } from '#modules/reports';
import { type ReviewUseCases, createReviewUseCases } from '#modules/reviews';
import { type ServiceUseCases, createServiceUseCases } from '#modules/services';
import { type SponsorUseCases, createSponsorUseCases } from '#modules/sponsors';
import { type SystemUserUseCases, createSystemUserUseCases } from '#modules/system-users';
import { type CertificateCodes, type TrackUseCases, createTrackUseCases, randomCertificateCodes, sha256CertificateHasher } from '#modules/tracks';
import { type VerificationUseCases, createVerificationUseCases } from '#modules/verification';
import { type WorkerUseCases, createWorkerUseCases } from '#modules/workers';
import { authTokenSecret } from '#shared/config';
import type { ChangeFeed } from '#shared/domain/changes';
import { type Clock, systemClock } from '#shared/domain/clock';
import type { DocumentStore } from '#shared/domain/documents';
import type { ImageProcessor, ImageStore } from '#shared/domain/images';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import type { ResetTokens, SessionTokens } from '#shared/domain/tokens';
import { type Transaction, directTransaction } from '#shared/domain/transaction';
import { createHmacSessionTokens, randomResetTokens, scryptPasswordHasher } from '#shared/infra/crypto/node-crypto';
import { InMemoryDocumentStore } from '#shared/infra/documents/in-memory-document-store';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import { SharpImageProcessor } from '#shared/infra/images/sharp-image-processor';
import { InMemoryChangeFeed } from '#shared/infra/memory/in-memory-change-feed';
import type { Repositories } from './repositories';
import { createInMemoryRepositories } from './repositories';

// Raiz de composição: o único lugar que escolhe as implementações concretas.
// Sem opções, tudo fica em memória (testes). O servidor com DATABASE_URL passa o PostgreSQL em `repos`,
// `images`, `documents` e `idDocuments` (src/postgres.ts). Com SUPABASE_*, os arquivos vão
// para um bucket do Supabase Storage (createSupabaseFileStores); para outro lugar (ex.: S3/R2), passe outro
// `images` (ver src/shared/domain/images.ts), `documents` e `idDocuments`.
// As senhas usam scrypt (`passwords`); os testes podem passar um hasher mais rápido.
// Os avisos de mudança para as telas abertas (`changes`, por SSE) ficam em memória;
// as notificações push saem pelo `push` (Web Push com as chaves VAPID do .env; os testes passam um falso),
// e ficam guardadas na central de notificações de cada perfil.
// Os tokens de sessão (`tokens`) são assinados com AUTH_TOKEN_SECRET; os códigos dos certificados
// (`certificateCodes`) são aleatórios, e os testes podem passar um gerador previsível.
// As fotos dos documentos da verificação de identidade (`idDocuments`) ficam num armazenamento à parte,
// privado: não passam por /api/images e são apagadas logo depois da decisão da equipe.

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
  reports: ReportUseCases;
  verification: VerificationUseCases;
  matching: MatchingUseCases;
  farmStats: FarmStatsUseCases;
  sponsors: SponsorUseCases;
}

export interface Container {
  repos: Repositories;
  images: ImageStore;
  documents: DocumentStore;
  idDocuments: ImageStore;
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
  // Grava várias entidades juntas (transação do PostgreSQL). Sem ela, direto nos repositórios.
  transaction?: Transaction<Repositories>;
  images?: ImageStore;
  documents?: DocumentStore;
  idDocuments?: ImageStore;
  imageProcessor?: ImageProcessor;
  passwords?: PasswordHasher;
  resetTokens?: ResetTokens;
  clock?: Clock;
  changes?: ChangeFeed;
  push?: PushSender;
  tokens?: SessionTokens;
  certificateCodes?: CertificateCodes;
  // Entrega do código de "esqueci a senha". Sem ela (o padrão, até o envio por e-mail existir), a redefinição fica desligada.
  deliverResetCode?: ResetCodeDelivery;
}

export function createContainer(options: ContainerOptions = {}): Container {
  const repos = options.repos ?? createInMemoryRepositories();
  const transaction = options.transaction ?? directTransaction(repos);
  const images = options.images ?? new InMemoryImageStore();
  const documents = options.documents ?? new InMemoryDocumentStore();
  const idDocuments = options.idDocuments ?? new InMemoryImageStore();
  const imageProcessor = options.imageProcessor ?? new SharpImageProcessor();
  const passwords = options.passwords ?? scryptPasswordHasher;
  const resetTokens = options.resetTokens ?? randomResetTokens;
  const clock = options.clock ?? systemClock;
  const changes = options.changes ?? new InMemoryChangeFeed();
  const tokens = options.tokens ?? createHmacSessionTokens(authTokenSecret(), clock);
  const { farmers, workers, farms, services, applications, payments, accounts, pushSubscriptions, notifications, systemUsers, workerReviews, farmReviews, chats, chatMessages, tracks, enrollments, certificates } = repos;
  const pushDeps = { accounts, pushSubscriptions, notifications, changes, clock, sender: options.push ?? new WebPushSender() };
  const notificationUseCases = createNotificationUseCases({ notifications, changes });
  const notifier = createPushDispatcher(pushDeps);
  // Avaliações e conversas vêm antes: a contratação e as vagas leem a reputação, a contratação abre
  // e fecha a conversa, e a remoção de um perfil apaga as conversas e as avaliações dele.
  const reviewUseCases = createReviewUseCases({ services, farms, workers, workerReviews, farmReviews, clock, changes, push: notifier });
  const chatUseCases = createChatUseCases({ chats, chatMessages, services, applications, proposals: repos.proposals, farmers, workers, clock, changes, push: notifier });
  // A verificação vem antes das vagas e da contratação, que mostram o selo.
  const verificationUseCases = createVerificationUseCases({
    verifications: repos.verifications, farmers, workers, accounts, idDocuments: { processor: imageProcessor, store: idDocuments }, clock, push: notifier
  });
  const cleanup: ProfileCleanup = {
    farmerRemoved: async (id) => {
      await hiringUseCases.cleanup.farmerRemoved(id); // convites
      await chatUseCases.cleanup.farmerRemoved(id);
      await reviewUseCases.cleanup.farmerRemoved(id);
      await notificationUseCases.removeFor('farmer', id);
      await verificationUseCases.removeFor('farmer', id);
    },
    workerRemoved: async (id) => {
      await hiringUseCases.cleanup.workerRemoved(id); // convites
      await chatUseCases.cleanup.workerRemoved(id);
      await reviewUseCases.cleanup.workerRemoved(id);
      await notificationUseCases.removeFor('worker', id);
      await verificationUseCases.removeFor('worker', id);
    }
  };
  const reputation = reviewUseCases.getReputation;
  // O pagamento de cada serviço, que só o trabalhador aceito vê junto do serviço dele.
  const servicePayments = servicePaymentReader(payments);
  // Vagas para você: as recomendações, os avisos de vaga nova (ligados na publicação das vagas) e o catálogo de prestadores.
  const matchingUseCases = createMatchingUseCases({
    jobPreferences: repos.jobPreferences, jobAlerts: repos.jobAlerts, catalogNotices: repos.catalogNotices, services, farms, applications,
    invites: repos.invites, tracks, enrollments, workers, accounts, reputation, verification: verificationUseCases.reader,
    workerReputation: reputation, workerVerification: verificationUseCases.reader, clock, push: notifier
  });
  // A contratação lê e grava as propostas e os convites; a conversa abre, fecha e mostra cada etapa; o catálogo
  // diz quem pode ser convidado.
  const hiringUseCases = createHiringUseCases({
    services, applications, payments, proposals: repos.proposals, invites: repos.invites, transaction, workers, farmers, farms, accounts, clock,
    changes, push: notifier, events: chatUseCases.hiringEvents, chats: chatUseCases.negotiationChats, reputation,
    verification: verificationUseCases.reader, catalog: matchingUseCases.catalog
  });
  const farmerUseCases = createFarmerUseCases({ farmers, workers, farms, services, applications, accounts, pushSubscriptions, clock, images, passwords, changes, cleanup });
  const workerUseCases = createWorkerUseCases({ servicePayments, workers, farmers, farms, services, applications, accounts, pushSubscriptions, clock, images, documents, passwords, changes, cleanup });
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
    idDocuments,
    passwords,
    clock,
    changes,
    tokens,
    notifier,
    useCases: {
      auth: createAuthUseCases({ accounts, farmers, workers, clock, passwords, resetTokens, deliverResetCode: options.deliverResetCode ?? null }),
      accounts: createAccountUseCases({ accounts, farmers, workers, profiles }),
      farmers: farmerUseCases,
      workers: workerUseCases,
      farms: createFarmUseCases({ farmers, farms, services, clock }),
      services: createServiceUseCases({
        farmers, farms, services, applications, clock, changes, push: notifier, reputation, verification: verificationUseCases.reader, servicePayments,
        jobEvents: { jobPublished: (service) => matchingUseCases.alerts.jobPublished(service), jobCancelled: async (service) => {
          await hiringUseCases.jobEvents.jobCancelled(service);
          await chatUseCases.hiringEvents.jobCancelled(service);
        } }
      }),
      hiring: hiringUseCases,
      reviews: reviewUseCases,
      chat: chatUseCases,
      photos: createPhotoUseCases({ farmers, workers, farms, images: { processor: imageProcessor, store: images } }),
      push: createPushUseCases(pushDeps),
      notifications: notificationUseCases,
      systemUsers: createSystemUserUseCases({ systemUsers, clock, passwords }),
      admin: createAdminUseCases({ accounts, farmers, workers, services, farmerUseCases, workerUseCases }),
      help: createHelpUseCases({ helpArticles: repos.helpArticles, clock }),
      verification: verificationUseCases,
      matching: matchingUseCases,
      sponsors: createSponsorUseCases({ sponsors: repos.sponsors, images: { processor: imageProcessor, store: images }, clock }),
      farmStats: createFarmStatsUseCases({ farmers, farms, services, payments, applications, workers, reputation, clock }),
      reports: createReportUseCases({ reports: repos.reports, farmers, workers, services, applications, accounts, clock, push: notifier }),
      tracks: createTrackUseCases({ tracks, enrollments, certificates, workers, systemUsers, clock, codes: options.certificateCodes ?? randomCertificateCodes, hasher: sha256CertificateHasher })
    }
  };
}
