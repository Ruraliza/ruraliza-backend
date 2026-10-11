import type { ChangeFeed } from '#shared/domain/changes';
import { type Clock, systemClock } from '#shared/domain/clock';
import type { DocumentStore } from '#shared/domain/documents';
import type { ImageProcessor, ImageStore } from '#shared/domain/images';
import type { ResetTokens } from './domain/passwords';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { PushSender } from './domain/push';
import type { SessionTokens } from '#shared/domain/tokens';
import type { Repositories } from './domain/repositories';
import { authTokenSecret } from '#shared/config';
import { createHmacSessionTokens, randomResetTokens, scryptPasswordHasher } from '#shared/infra/crypto/node-crypto';
import { SharpImageProcessor } from '#shared/infra/images/sharp-image-processor';
import { createInMemoryRepositories } from './infra/memory';
import { InMemoryChangeFeed } from '#shared/infra/memory/in-memory-change-feed';
import { InMemoryDocumentStore } from '#shared/infra/documents/in-memory-document-store';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import { WebPushSender } from '#shared/infra/push/web-push-sender';
import { type FarmUseCases, createFarmUseCases } from '#modules/farms';
import { type ServiceUseCases, createServiceUseCases } from '#modules/services';
import { AccountUseCases } from './usecases/AccountUseCases';
import { AdminUseCases } from './usecases/AdminUseCases';
import { AuthUseCases } from './usecases/AuthUseCases';
import { FarmerUseCases } from './usecases/FarmerUseCases';
import { HiringUseCases } from './usecases/HiringUseCases';
import { PhotoUseCases } from './usecases/PhotoUseCases';
import { PushUseCases } from './usecases/PushUseCases';
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
  const pushUseCases = new PushUseCases({ accounts, pushSubscriptions }, clock, options.push ?? new WebPushSender());
  const farmerUseCases = new FarmerUseCases({ farmers, workers, farms, services, applications, accounts, pushSubscriptions }, clock, images, passwords, changes);
  const workerUseCases = new WorkerUseCases({ workers, farmers, services, applications, farms, accounts, pushSubscriptions }, clock, { images, documents }, passwords, changes);

  return {
    repos,
    images,
    documents,
    passwords,
    clock,
    changes,
    tokens,
    useCases: {
      auth: new AuthUseCases({ farmers, workers, accounts }, clock, { hasher: passwords, resetTokens }),
      accounts: new AccountUseCases({ accounts, farmers, workers }, { farmers: farmerUseCases, workers: workerUseCases }),
      farmers: farmerUseCases,
      workers: workerUseCases,
      farms: createFarmUseCases({ farmers, farms, services, clock }),
      services: createServiceUseCases({ farmers, farms, services, applications, clock, changes, push: pushUseCases }),
      hiring: new HiringUseCases({ services, applications, workers, payments, accounts }, clock, changes, pushUseCases),
      photos: new PhotoUseCases({ farmers, workers, farms }, { processor: imageProcessor, store: images }),
      resumes: new ResumeUseCases({ workers }, documents),
      push: pushUseCases,
      systemUsers: new SystemUserUseCases({ systemUsers }, clock, passwords),
      admin: new AdminUseCases({ accounts, farmers, workers, services }, { farmers: farmerUseCases, workers: workerUseCases })
    }
  };
}
