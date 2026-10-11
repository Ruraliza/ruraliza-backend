import type { ImageStore, StoredImage } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';

export interface GetImageDeps {
  images: { store: ImageStore };
}

// Bytes para GET /api/images/:id.
export class GetImageUseCase {
  constructor(private readonly deps: GetImageDeps) {}

  async execute({ imageId }: { imageId: string }): Promise<Result<StoredImage>> {
    const image = await this.deps.images.store.get(imageId);
    return image ? ok(image) : notFound('Imagem não encontrada.');
  }
}
