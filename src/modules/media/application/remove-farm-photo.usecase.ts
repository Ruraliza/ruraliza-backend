import { type Farm, type FarmRepository, findOwnFarm } from '#modules/farms';
import type { ImageStore } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { FarmerRepository } from '../../../domain/repositories';

export interface RemoveFarmPhotoDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  images: { store: ImageStore };
}

export interface RemoveFarmPhotoInput {
  farmerId: number;
  farmId: number;
  photoId: string;
}

// Tira a foto da fazenda e a apaga do store.
export class RemoveFarmPhotoUseCase {
  constructor(private readonly deps: RemoveFarmPhotoDeps) {}

  async execute({ farmerId, farmId, photoId }: RemoveFarmPhotoInput): Promise<Result<Farm>> {
    const found = await findOwnFarm(this.deps, farmerId, farmId);
    if (!found.ok) return found;
    const { farm } = found.value;

    const photo = farm.photos.find((p) => p.id === photoId);
    if (!photo) return notFound('Foto não encontrada nesta fazenda.');

    await this.deps.images.store.delete(photo.id);
    farm.photos = farm.photos.filter((p) => p.id !== photoId);
    await this.deps.farms.update(farm);
    return ok(farm);
  }
}
