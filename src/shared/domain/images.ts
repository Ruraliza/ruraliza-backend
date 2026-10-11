import type { Result } from './result';

// Fotos (perfil do produtor/trabalhador e fazendas).
//
// Duas peças separadas, cada uma trocável no container:
// - ImageProcessor: valida e normaliza a imagem enviada (≤ 1000px no maior lado, WebP;
//   fotos de perfil também saem quadradas).
// - ImageStore: guarda os bytes e diz a URL pública de cada imagem.
//
// Hoje: SharpImageProcessor + InMemoryImageStore (some ao reiniciar).
// TODO(db): trocar o InMemoryImageStore por um store de arquivos (S3, Cloudflare R2, disco do
// servidor...). Não guarde bytes de imagem no PostgreSQL: no banco fica só a URL (ou a chave),
// que é o que as entidades já guardam (`photo_url`, `farm.photos`).

export const IMAGE_MAX_SIDE = 1000; // px, no maior lado
export const IMAGE_MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // corpo aceito antes de processar
export const MAX_FARM_PHOTOS = 6;

export interface ProcessedImage {
  bytes: Uint8Array;
  contentType: string; // sempre image/webp hoje
  width: number;
  height: number;
}

export interface NormalizeOptions {
  // Recorta um quadrado central (fotos de perfil). O app já envia a foto recortada pelo usuário;
  // aqui é só a garantia para quem enviar outra proporção.
  square?: boolean;
}

export interface ImageProcessor {
  // Recusa (invalid) o que não for imagem legível.
  normalize(input: Uint8Array, options?: NormalizeOptions): Promise<Result<ProcessedImage>>;
}

export interface StoredImage {
  bytes: Uint8Array;
  contentType: string;
}

export interface ImageStore {
  // Guarda e devolve o id da imagem.
  save(image: ProcessedImage): Promise<string>;
  get(id: string): Promise<StoredImage | undefined>;
  delete(id: string): Promise<void>;
  // URL pública (relativa à API hoje; absoluta quando for um bucket/CDN).
  urlFor(id: string): string;
  // Id a partir de uma URL gerada por este store (para remover a foto antiga).
  idFromUrl(url: string): string | undefined;
}

// Apaga do store a imagem de uma URL gerada por ele (sem erro se não houver, ou se for de outro lugar).
export async function releaseImage(store: ImageStore, url: string | null): Promise<void> {
  if (url === null) return;
  const id = store.idFromUrl(url);
  if (id !== undefined) await store.delete(id);
}
