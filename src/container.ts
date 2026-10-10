import { type Clock, systemClock } from './domain/clock';
import type { DocumentStore } from './domain/documents';
import type { ImageProcessor, ImageStore } from './domain/images';
import type { Repositories } from './domain/repositories';
import { SharpImageProcessor } from './infra/images/SharpImageProcessor';
import { createInMemoryRepositories } from './infra/memory';
import { InMemoryDocumentStore } from './infra/memory/InMemoryDocumentStore';
import { InMemoryImageStore } from './infra/memory/InMemoryImageStore';
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

export interface UseCases {
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
  clock: Clock;
  useCases: UseCases;
}

export interface ContainerOptions {
  repos?: Repositories;
  images?: ImageStore;
  documents?: DocumentStore;
  imageProcessor?: ImageProcessor;
  clock?: Clock;
}

export function createContainer(options: ContainerOptions = {}): Container {
  const repos = options.repos ?? createInMemoryRepositories();
  const images = options.images ?? new InMemoryImageStore();
  const documents = options.documents ?? new InMemoryDocumentStore();
  const imageProcessor = options.imageProcessor ?? new SharpImageProcessor();
  const clock = options.clock ?? systemClock;
  const { farmers, workers, farms, services, applications, payments } = repos;

  return {
    repos,
    images,
    documents,
    clock,
    useCases: {
      farmers: new FarmerUseCases({ farmers, farms, services, applications }, clock, images),
      workers: new WorkerUseCases({ workers, services, applications, farms }, clock, { images, documents }),
      farms: new FarmUseCases({ farmers, farms, services }, clock),
      services: new ServiceUseCases({ farmers, workers, farms, services, applications }, clock),
      hiring: new HiringUseCases({ services, applications, workers, payments }, clock),
      photos: new PhotoUseCases({ farmers, workers, farms }, { processor: imageProcessor, store: images }),
      resumes: new ResumeUseCases({ workers }, documents)
    }
  };
}
