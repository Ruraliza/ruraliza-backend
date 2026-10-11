import type { FarmerRepository } from '#modules/farmers';
import { type ImageStore, releaseImage } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { Farmer } from '../../../contracts';

export interface RemoveFarmerPhotoDeps {
  farmers: FarmerRepository;
  images: { store: ImageStore };
}

export interface RemoveFarmerPhotoInput {
  farmerId: number;
}

// Remove a foto de perfil (photo_url = null) e a apaga do store.
export class RemoveFarmerPhotoUseCase {
  constructor(private readonly deps: RemoveFarmerPhotoDeps) {}

  async execute({ farmerId }: RemoveFarmerPhotoInput): Promise<Result<Farmer>> {
    const farmer = await this.deps.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    await releaseImage(this.deps.images.store, farmer.photo_url);
    farmer.photo_url = null;
    await this.deps.farmers.update(farmer);
    return ok(farmer);
  }
}
