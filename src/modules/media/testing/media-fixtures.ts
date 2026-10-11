import { type Farm, createInMemoryFarmRepository } from '#modules/farms';
import type { ImageProcessor, NormalizeOptions } from '#shared/domain/images';
import { invalid, ok } from '#shared/domain/result';
import { InMemoryImageStore } from '#shared/infra/images/in-memory-image-store';
import type { Farmer, Worker } from '../../../contracts';
import { createInMemoryRepositories } from '../../../infra/memory';
import type { MediaModuleDeps } from '../media.module';

// Dependências das fotos em memória, com um ImageProcessor falso: "imagem" é qualquer byte que
// comece com 0x89 (o redimensionamento de verdade, com Sharp, é testado em tests/).

export const NOW = '2026-01-01T00:00:00.000Z';
export const IMAGE = new Uint8Array([0x89, 1, 2, 3]);
export const NOT_IMAGE = new TextEncoder().encode('texto');

export interface MediaTestbed extends MediaModuleDeps {
  images: { processor: ImageProcessor & { calls: (NormalizeOptions | undefined)[] }; store: InMemoryImageStore };
}

export function mediaTestbed(): MediaTestbed {
  const { farmers, workers } = createInMemoryRepositories();
  const calls: (NormalizeOptions | undefined)[] = [];
  const processor = {
    calls,
    normalize: (input: Uint8Array, options?: NormalizeOptions) => {
      calls.push(options);
      return Promise.resolve(input[0] === 0x89
        ? ok({ bytes: input, contentType: 'image/webp', width: 10, height: 10 })
        : invalid('O arquivo enviado não é uma imagem válida.'));
    }
  };
  return { farmers, workers, farms: createInMemoryFarmRepository(), images: { processor, store: new InMemoryImageStore() } };
}

export function givenFarmer(t: MediaTestbed, photo_url: string | null = null): Promise<Farmer> {
  return t.farmers.create({ email: 'ana@exemplo.com', name: 'Ana', phone: '1', cpf: '52998224725', farms: [], photo_url, insertion_date: NOW });
}

export function givenWorker(t: MediaTestbed, photo_url: string | null = null): Promise<Worker> {
  return t.workers.create({
    email: 'maria@exemplo.com', name: 'Maria', phone: '1', cpf: '11144477735',
    bio: null, certificates: null, courses: null, experience: null, photo_url, resume_url: null, insertion_date: NOW
  });
}

export function givenFarm(t: MediaTestbed, farmer: Farmer, changes: Partial<Farm> = {}): Promise<Farm> {
  return t.farms.create({
    farmer_id: farmer.id, address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: null, longitude: null,
    photos: [], insertion_date: NOW, ...changes
  });
}

// Guarda uma imagem no store e devolve a URL dela (como uma foto enviada antes).
export async function storedImageUrl(t: MediaTestbed): Promise<string> {
  const id = await t.images.store.save({ bytes: IMAGE, contentType: 'image/webp', width: 10, height: 10 });
  return t.images.store.urlFor(id);
}
