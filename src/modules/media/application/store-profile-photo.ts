import type { ImageProcessor, ImageStore } from '#shared/domain/images';
import { type Result, ok } from '#shared/domain/result';

export interface PhotoStorage {
  processor: ImageProcessor;
  store: ImageStore;
}

// Foto de perfil: sempre quadrada (quadrado central, até 1000px), em WebP. Devolve a URL pública.
export async function storeProfilePhoto(images: PhotoStorage, upload: Uint8Array): Promise<Result<string>> {
  const processed = await images.processor.normalize(upload, { square: true });
  if (!processed.ok) return processed;
  const id = await images.store.save(processed.value);
  return ok(images.store.urlFor(id));
}
