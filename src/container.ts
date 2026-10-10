import type { ChangeFeed } from './domain/changes';
import { type Clock, systemClock } from './domain/clock';
import type { DocumentStore } from './domain/documents';
import type { ImageProcessor, ImageStore } from './domain/images';
import type { PasswordHasher, ResetTokens } from './domain/passwords';
import type { PushSender } from './domain/push';
import type { Repositories } from './domain/repositories';
import { randomResetTokens, scryptPasswordHasher } from './infra/crypto/NodeCrypto';
import { SharpImageProcessor } from './infra/images/SharpImageProcessor';
import { createInMemoryRepositories } from './infra/memory';
import { InMemoryChangeFeed } from './infra/memory/InMemoryChangeFeed';
import { InMemoryDocumentStore } from './infra/memory/InMemoryDocumentStore';
import { InMemoryImageStore } from './infra/memory/InMemoryImageStore';
import { WebPushSender } from './infra/push/WebPushSender';
import { AccountUseCases } from './usecases/AccountUseCases';
import { AuthUseCases } from './usecases/AuthUseCases';
import { FarmUseCases } from './usecases/FarmUseCases';
import { FarmerUseCases } from './usecases/FarmerUseCases';
import { HiringUseCases } from './usecases/HiringUseCases';
import { PhotoUseCases } from './usecases/PhotoUseCases';
import { PushUseCases } from './usecases/PushUseCases';
import { ResumeUseCases } from './usecases/ResumeUseCases';
import { ServiceUseCases } from './usecases/ServiceUseCases';
import { WorkerUseCases } from './usecases/WorkerUseCases';

// Raiz de composição: o único lugar que escolhe as implementações concretas.
// Para trocar a persistência (ex.: PostgreSQL), passe outros `repos` aqui; para guardar as
// fotos fora da memória (ex.: S3/R2 ou disco), passe outro `images` (ver src/domain/images.ts);
// para os currículos em PDF, outro `documents` (ver src/domain/documents.ts).
// As senhas usam scrypt (`passwords`); os testes podem passar um hasher mais rápido.
// Os avisos de mudança para as telas abertas (`changes`, por SSE) ficam em memória;
// as notificações push saem pelo `push` (Web Push com as chaves VAPID do .env; os testes passam um falso).

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
}

export interface Container {
  repos: Repositories;
  images: ImageStore;
  documents: DocumentStore;
  passwords: PasswordHasher;
  clock: Clock;
  changes: ChangeFeed;
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
  const { farmers, workers, farms, services, applications, payments, accounts, pushSubscriptions } = repos;
  const pushUseCases = new PushUseCases({ accounts, pushSubscriptions }, clock, options.push ?? new WebPushSender());
  const farmerUseCases = new FarmerUseCases({ farmers, workers, farms, services, applications, accounts }, clock, images, passwords, changes);
  const workerUseCases = new WorkerUseCases({ workers, farmers, services, applications, farms, accounts }, clock, { images, documents }, passwords, changes);

  return {
    repos,
    images,
    documents,
    passwords,
    clock,
    changes,
    useCases: {
      auth: new AuthUseCases({ farmers, workers, accounts }, clock, { hasher: passwords, resetTokens }),
      accounts: new AccountUseCases({ accounts, farmers, workers }, { farmers: farmerUseCases, workers: workerUseCases }),
      farmers: farmerUseCases,
      workers: workerUseCases,
      farms: new FarmUseCases({ farmers, farms, services }, clock),
      services: new ServiceUseCases({ farmers, workers, farms, services, applications }, clock, changes, pushUseCases),
      hiring: new HiringUseCases({ services, applications, workers, payments, accounts }, clock, changes, pushUseCases),
      photos: new PhotoUseCases({ farmers, workers, farms }, { processor: imageProcessor, store: images }),
      resumes: new ResumeUseCases({ workers }, documents),
      push: pushUseCases
    }
  };
}
