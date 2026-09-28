import { type Clock, systemClock } from './domain/clock';
import type { Repositories } from './domain/repositories';
import { createInMemoryRepositories } from './infra/memory';
import { FarmUseCases } from './usecases/FarmUseCases';
import { FarmerUseCases } from './usecases/FarmerUseCases';
import { HiringUseCases } from './usecases/HiringUseCases';
import { ServiceUseCases } from './usecases/ServiceUseCases';
import { WorkerUseCases } from './usecases/WorkerUseCases';

// Raiz de composição: o único lugar que escolhe as implementações concretas.
// Para trocar a persistência (ex.: PostgreSQL), passe outros `repos` aqui.

export interface UseCases {
  farmers: FarmerUseCases;
  workers: WorkerUseCases;
  farms: FarmUseCases;
  services: ServiceUseCases;
  hiring: HiringUseCases;
}

export interface Container {
  repos: Repositories;
  clock: Clock;
  useCases: UseCases;
}

export interface ContainerOptions {
  repos?: Repositories;
  clock?: Clock;
}

export function createContainer(options: ContainerOptions = {}): Container {
  const repos = options.repos ?? createInMemoryRepositories();
  const clock = options.clock ?? systemClock;
  const { farmers, workers, farms, services, applications, payments } = repos;

  return {
    repos,
    clock,
    useCases: {
      farmers: new FarmerUseCases({ farmers, farms, services, applications }, clock),
      workers: new WorkerUseCases({ workers, services, applications, farms }, clock),
      farms: new FarmUseCases({ farmers, farms, services }, clock),
      services: new ServiceUseCases({ farmers, workers, farms, services, applications }, clock),
      hiring: new HiringUseCases({ services, applications, workers, payments }, clock)
    }
  };
}
