import { releaseImage } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { Farmer } from '../../../contracts';
import type { FarmerRepository } from '../../../domain/repositories';
import { type PhotoStorage, storeProfilePhoto } from './store-profile-photo';

export interface SetFarmerPhotoDeps {
  farmers: FarmerRepository;
  images: PhotoStorage;
}

export interface SetFarmerPhotoInput {
  farmerId: number;
  upload: Uint8Array;
}

// Envia (ou troca) a foto de perfil; a anterior sai do store.
export class SetFarmerPhotoUseCase {
  constructor(private readonly deps: SetFarmerPhotoDeps) {}

  async execute({ farmerId, upload }: SetFarmerPhotoInput): Promise<Result<Farmer>> {
    const farmer = await this.deps.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const url = await storeProfilePhoto(this.deps.images, upload);
    if (!url.ok) return url;
    await releaseImage(this.deps.images.store, farmer.photo_url);
    farmer.photo_url = url.value;
    await this.deps.farmers.update(farmer);
    return ok(farmer);
  }
}
