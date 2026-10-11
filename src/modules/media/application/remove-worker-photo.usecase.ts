import type { WorkerRepository } from '#modules/workers';
import type { Worker } from '#modules/workers';
import { type ImageStore, releaseImage } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';

export interface RemoveWorkerPhotoDeps {
  workers: WorkerRepository;
  images: { store: ImageStore };
}

export interface RemoveWorkerPhotoInput {
  workerId: number;
}

// Remove a foto de perfil (photo_url = null) e a apaga do store.
export class RemoveWorkerPhotoUseCase {
  constructor(private readonly deps: RemoveWorkerPhotoDeps) {}

  async execute({ workerId }: RemoveWorkerPhotoInput): Promise<Result<Worker>> {
    const worker = await this.deps.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    await releaseImage(this.deps.images.store, worker.photo_url);
    worker.photo_url = null;
    await this.deps.workers.update(worker);
    return ok(worker);
  }
}
