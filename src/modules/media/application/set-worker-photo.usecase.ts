import type { WorkerRepository } from '#modules/workers';
import type { Worker } from '#modules/workers';
import { releaseImage } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';
import { type PhotoStorage, storeProfilePhoto } from './store-profile-photo';

export interface SetWorkerPhotoDeps {
  workers: WorkerRepository;
  images: PhotoStorage;
}

export interface SetWorkerPhotoInput {
  workerId: number;
  upload: Uint8Array;
}

// Envia (ou troca) a foto de perfil; a anterior sai do store.
export class SetWorkerPhotoUseCase {
  constructor(private readonly deps: SetWorkerPhotoDeps) {}

  async execute({ workerId, upload }: SetWorkerPhotoInput): Promise<Result<Worker>> {
    const worker = await this.deps.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const url = await storeProfilePhoto(this.deps.images, upload);
    if (!url.ok) return url;
    await releaseImage(this.deps.images.store, worker.photo_url);
    worker.photo_url = url.value;
    await this.deps.workers.update(worker);
    return ok(worker);
  }
}
