import type { FarmerRepository } from '#modules/farmers';
import { type Farm, type FarmRepository, findOwnFarm } from '#modules/farms';
import { type ImageProcessor, type ImageStore, MAX_FARM_PHOTOS } from '#shared/domain/images';
import { type Result, conflict, ok } from '#shared/domain/result';

export interface AddFarmPhotoDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  images: { processor: ImageProcessor; store: ImageStore };
}

export interface AddFarmPhotoInput {
  farmerId: number;
  farmId: number;
  upload: Uint8Array;
}

// Acrescenta uma foto (até MAX_FARM_PHOTOS; a primeira é a capa). Mantém a proporção, até 1000px.
export class AddFarmPhotoUseCase {
  constructor(private readonly deps: AddFarmPhotoDeps) {}

  async execute({ farmerId, farmId, upload }: AddFarmPhotoInput): Promise<Result<Farm>> {
    const found = await findOwnFarm(this.deps, farmerId, farmId);
    if (!found.ok) return found;
    const { farm } = found.value;
    if (farm.photos.length >= MAX_FARM_PHOTOS) {
      return conflict(`A fazenda já tem ${MAX_FARM_PHOTOS} fotos. Remova uma antes de enviar outra.`);
    }

    const processed = await this.deps.images.processor.normalize(upload);
    if (!processed.ok) return processed;
    const id = await this.deps.images.store.save(processed.value);
    farm.photos.push({ id, url: this.deps.images.store.urlFor(id) });
    await this.deps.farms.update(farm);
    return ok(farm);
  }
}
