import sharp from 'sharp';
import { IMAGE_MAX_SIDE, type ImageProcessor, type ProcessedImage } from '../../domain/images';
import { type Result, invalid, ok } from '../../domain/result';

const WEBP_QUALITY = 78;
// Evita "bombas de descompressão" (arquivo pequeno que vira imagem gigante na memória).
const MAX_INPUT_PIXELS = 50_000_000;

// Normaliza qualquer foto recebida (JPEG, PNG, WebP, AVIF, HEIC suportado pelo libvips…):
// corrige a rotação do celular (EXIF), reduz para no máximo 1000px no maior lado
// (sem ampliar fotos menores), remove os metadados (inclusive GPS) e converte para WebP.
export class SharpImageProcessor implements ImageProcessor {
  async normalize(input: Uint8Array): Promise<Result<ProcessedImage>> {
    try {
      const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return ok({ bytes: new Uint8Array(data), contentType: 'image/webp', width: info.width, height: info.height });
    } catch {
      return invalid('Não foi possível ler a imagem. Envie uma foto JPEG, PNG, WebP ou AVIF.');
    }
  }
}
