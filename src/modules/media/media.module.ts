import type { FarmerRepository } from '#modules/farmers';
import type { FarmRepository } from '#modules/farms';
import type { WorkerRepository } from '#modules/workers';
import type { ImageProcessor, ImageStore } from '#shared/domain/images';
import type { AccessPolicies } from '../../http/access';
import { AddFarmPhotoUseCase } from './application/add-farm-photo.usecase';
import { GetImageUseCase } from './application/get-image.usecase';
import { RemoveFarmPhotoUseCase } from './application/remove-farm-photo.usecase';
import { RemoveFarmerPhotoUseCase } from './application/remove-farmer-photo.usecase';
import { RemoveWorkerPhotoUseCase } from './application/remove-worker-photo.usecase';
import { SetFarmerPhotoUseCase } from './application/set-farmer-photo.usecase';
import { SetWorkerPhotoUseCase } from './application/set-worker-photo.usecase';
import { createPhotoController } from './presentation/photo.controller';
import { type PhotoRoutes, photoRoutes } from './presentation/photo.routes';

export interface MediaModuleDeps {
  farmers: FarmerRepository;
  workers: WorkerRepository;
  farms: FarmRepository;
  // Toda imagem passa pelo processor (≤ 1000px, WebP, sem metadados) antes de ir para o store;
  // a entidade guarda só a URL.
  images: { processor: ImageProcessor; store: ImageStore };
}

export interface PhotoUseCases {
  getImage: GetImageUseCase;
  setFarmerPhoto: SetFarmerPhotoUseCase;
  removeFarmerPhoto: RemoveFarmerPhotoUseCase;
  setWorkerPhoto: SetWorkerPhotoUseCase;
  removeWorkerPhoto: RemoveWorkerPhotoUseCase;
  addFarmPhoto: AddFarmPhotoUseCase;
  removeFarmPhoto: RemoveFarmPhotoUseCase;
}

// Casos de uso das fotos (montados pelo container).
export function createPhotoUseCases(deps: MediaModuleDeps): PhotoUseCases {
  return {
    getImage: new GetImageUseCase(deps),
    setFarmerPhoto: new SetFarmerPhotoUseCase(deps),
    removeFarmerPhoto: new RemoveFarmerPhotoUseCase(deps),
    setWorkerPhoto: new SetWorkerPhotoUseCase(deps),
    removeWorkerPhoto: new RemoveWorkerPhotoUseCase(deps),
    addFarmPhoto: new AddFarmPhotoUseCase(deps),
    removeFarmPhoto: new RemoveFarmPhotoUseCase(deps)
  };
}

// Rotas HTTP das fotos (perfis, fazendas e os bytes em /api/images).
export function createPhotoRoutes(useCases: PhotoUseCases, access: AccessPolicies): PhotoRoutes {
  return photoRoutes(createPhotoController(useCases), access);
}
