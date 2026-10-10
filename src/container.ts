import type { ChangeFeed } from './domain/changes';
import { type Clock, systemClock } from './domain/clock';
import type { DocumentStore } from './domain/documents';
import type { ImageProcessor, ImageStore } from './domain/images';
import type { PasswordHasher, ResetTokens } from './domain/passwords';
import type { Repositories } from './domain/repositories';
import { randomResetTokens, scryptPasswordHasher } from './infra/crypto/NodeCrypto';
import { SharpImageProcessor } from './infra/images/SharpImageProcessor';
import { createInMemoryRepositories } from './infra/memory';
import { InMemoryChangeFeed } from './infra/memory/InMemoryChangeFeed';
import { InMemoryDocumentStore } from './infra/memory/InMemoryDocumentStore';
import { InMemoryImageStore } from './infra/memory/InMemoryImageStore';
import { AuthUseCases } from './usecases/AuthUseCases';
import { FarmUseCases } from './usecases/FarmUseCases';
import { FarmerUseCases } from './usecases/FarmerUseCases';
import { HiringUseCases } from './usecases/HiringUseCases';
import { PhotoUseCases } from './usecases/PhotoUseCases';
import { ResumeUseCases } from './usecases/ResumeUseCases';
import { ServiceUseCases } from './usecases/ServiceUseCases';
import { WorkerUseCases } from './usecases/WorkerUseCases';

// Raiz de composição: o único lugar que escolhe as implementações concretas.
// Para trocar a persistência (ex.: PostgreSQL), passe outros `repos` aqui; para guardar as
// fotos fora da memória (ex.: S3/R2 ou disco), passe outro `images` (ver src/domain/images.ts);
// para os currículos em PDF, outro `documents` (ver src/domain/documents.ts).
// As senhas usam scrypt (`passwords`); os testes podem passar um hasher mais rápido.
// Os avisos de mudança para as telas abertas (`changes`, por SSE) ficam em memória.

export interface UseCases {
  auth: AuthUseCases;
  farmers: FarmerUseCases;
  workers: WorkerUseCases;
  farms: FarmUseCases;
  services: ServiceUseCases;
  hiring: HiringUseCases;
  photos: PhotoUseCases;
  resumes: ResumeUseCases;
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
  const { farmers, workers, farms, services, applications, payments, credentials } = repos;

  return {
    repos,
    images,
    documents,
    passwords,
    clock,
    changes,
    useCases: {
      auth: new AuthUseCases({ farmers, workers, credentials }, clock, { hasher: passwords, resetTokens }),
      farmers: new FarmerUseCases({ farmers, farms, services, applications, credentials }, clock, images, passwords, changes),
      workers: new WorkerUseCases({ workers, services, applications, farms, credentials }, clock, { images, documents }, passwords, changes),
      farms: new FarmUseCases({ farmers, farms, services }, clock),
      services: new ServiceUseCases({ farmers, workers, farms, services, applications }, clock, changes),
      hiring: new HiringUseCases({ services, applications, workers, payments }, clock, changes),
      photos: new PhotoUseCases({ farmers, workers, farms }, { processor: imageProcessor, store: images }),
      resumes: new ResumeUseCases({ workers }, documents)
    }
  };
}
