import { randomUUID } from 'node:crypto';
import type { ImageStore, ProcessedImage, StoredImage } from '../../domain/images';

const URL_PREFIX = '/api/images/';

// Imagens guardadas em memória (Map id → bytes). Tudo some quando o processo reinicia.
// Servidas por GET /api/images/:id. Ver src/domain/images.ts para a troca por um store real.
export class InMemoryImageStore implements ImageStore {
  private readonly images = new Map<string, StoredImage>();

  save(image: ProcessedImage): Promise<string> {
    const id = `${randomUUID()}.webp`;
    this.images.set(id, { bytes: image.bytes, contentType: image.contentType });
    return Promise.resolve(id);
  }

  get(id: string): Promise<StoredImage | undefined> {
    return Promise.resolve(this.images.get(id));
  }

  delete(id: string): Promise<void> {
    this.images.delete(id);
    return Promise.resolve();
  }

  urlFor(id: string): string {
    return `${URL_PREFIX}${id}`;
  }

  idFromUrl(url: string): string | undefined {
    return url.startsWith(URL_PREFIX) ? url.slice(URL_PREFIX.length) : undefined;
  }
}
