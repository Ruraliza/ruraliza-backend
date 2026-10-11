import { type AccountUseCases, type ProfileFactory, createAccountUseCases } from '#modules/accounts';
import { type FarmerUseCases, createFarmerUseCases } from '#modules/farmers';
import { type FarmUseCases, createFarmUseCases } from '#modules/farms';
import { type HiringUseCases, createHiringUseCases } from '#modules/hiring';
import { type PhotoUseCases, createPhotoUseCases } from '#modules/media';
import { type PushDispatcher, type PushSender, type PushUseCases, WebPushSender, createPushDispatcher, createPushUseCases } from '#modules/notifications';
import { type ServiceUseCases, createServiceUseCases } from '#modules/services';
import { authTokenSecret } from '#shared/config';
import type { ChangeFeed } from '#shared/domain/changes';
import { type Clock, systemClock } from '#shared/domain/clock';
import type { DocumentStore } from '#shared/domain/documents';
import type { ImageProcessor, ImageStore } from '#shared/domain/images';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { SessionTokens } from '#shared/domain/tokens';
import { createHmacSessionTokens, randomResetTokens, scryptPasswordHasher } from '#shared/infra/crypto/node-crypto';
import { InMemoryDocumentStore } from '#shared/infra/documents/in-memory-document-store';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import { SharpImageProcessor } from '#shared/infra/images/sharp-image-processor';
import { InMemoryChangeFeed } from '#shared/infra/memory/in-memory-change-feed';
import type { ResetTokens } from './domain/passwords';
import type { Repositories } from './domain/repositories';
import { createInMemoryRepositories } from './infra/memory';
import { AdminUseCases } from './usecases/AdminUseCases';
import { AuthUseCases } from './usecases/AuthUseCases';
import { ResumeUseCases } from './usecases/ResumeUseCases';
import { SystemUserUseCases } from './usecases/SystemUserUseCases';
import { WorkerUseCases } from './usecases/WorkerUseCases';

// Raiz de composição: o único lugar que escolhe as implementações concretas.
// Para trocar a persistência (ex.: PostgreSQL), passe outros `repos` aqui; para guardar as
// fotos fora da memória (ex.: S3/R2 ou disco), passe outro `images` (ver src/domain/images.ts);
// para os currículos em PDF, outro `documents` (ver src/domain/documents.ts).
// As senhas usam scrypt (`passwords`); os testes podem passar um hasher mais rápido.
// Os avisos de mudança para as telas abertas (`changes`, por SSE) ficam em memória;
// as notificações push saem pelo `push` (Web Push com as chaves VAPID do .env; os testes passam um falso).
// Os tokens de sessão (`tokens`) são assinados com AUTH_TOKEN_SECRET.

export interface UseCases {
  auth: AuthUseCases;
  accounts: AccountUseCases;
  farmers: FarmerUseCases;
  workers: WorkerUseCases;
  farms: FarmUseCases;
  services: ServiceUseCases;
  hiring: HiringUseCases;
  photos: PhotoUseCases;
  resumes: ResumeUseCases;
  push: PushUseCases;
  systemUsers: SystemUserUseCases;
  admin: AdminUseCases;
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
  tokens?: SessionTokens;
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
  const { farmers, workers, farms, services, applications, payments, accounts, pushSubscriptions, systemUsers } = repos;
  const pushDeps = { accounts, pushSubscriptions, clock, sender: options.push ?? new WebPushSender() };
  const notifier = createPushDispatcher(pushDeps);
  const farmerUseCases = createFarmerUseCases({ farmers, workers, farms, services, applications, accounts, pushSubscriptions, clock, images, passwords, changes });
  const workerUseCases = new WorkerUseCases({ workers, farmers, services, applications, farms, accounts, pushSubscriptions }, clock, { images, documents }, passwords, changes);
  // O segundo perfil de uma conta (src/modules/accounts) é criado pelos casos de uso dos perfis.
  const profiles: ProfileFactory = {
    create: (role, { bio, certificates, courses, experience, ...base }) => role === 'farmer'
      ? farmerUseCases.createFarmerProfile.execute(base)
      : workerUseCases.createProfile({ ...base, bio, certificates, courses, experience })
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
      auth: new AuthUseCases({ farmers, workers, accounts }, clock, { hasher: passwords, resetTokens }),
      accounts: createAccountUseCases({ accounts, farmers, workers, profiles }),
      farmers: farmerUseCases,
      workers: workerUseCases,
      farms: createFarmUseCases({ farmers, farms, services, clock }),
      services: createServiceUseCases({ farmers, farms, services, applications, clock, changes, push: notifier }),
      hiring: createHiringUseCases({ services, applications, payments, workers, accounts, clock, changes, push: notifier }),
      photos: createPhotoUseCases({ farmers, workers, farms, images: { processor: imageProcessor, store: images } }),
      resumes: new ResumeUseCases({ workers }, documents),
      push: createPushUseCases(pushDeps),
      systemUsers: new SystemUserUseCases({ systemUsers }, clock, passwords),
      admin: new AdminUseCases({ accounts, farmers, workers, services }, { farmers: farmerUseCases, workers: workerUseCases })
    }
  };
}
