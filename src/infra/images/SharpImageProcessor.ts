import sharp from 'sharp';
import { IMAGE_MAX_SIDE, type ImageProcessor, type NormalizeOptions, type ProcessedImage } from '../../domain/images';
import { type Result, invalid, ok } from '../../domain/result';

const WEBP_QUALITY = 78;
// Evita "bombas de descompressão" (arquivo pequeno que vira imagem gigante na memória).
const MAX_INPUT_PIXELS = 50_000_000;

// Normaliza qualquer foto recebida (JPEG, PNG, WebP, AVIF, HEIC suportado pelo libvips…):
// corrige a rotação do celular (EXIF), reduz para no máximo 1000px no maior lado
// (sem ampliar fotos menores), remove os metadados (inclusive GPS) e converte para WebP.
// Com `square`, recorta o quadrado central (lado = menor lado da foto, até 1000px).
export class SharpImageProcessor implements ImageProcessor {
  async normalize(input: Uint8Array, options: NormalizeOptions = {}): Promise<Result<ProcessedImage>> {
    try {
      const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
      if (options.square) {
        // Tamanho já girado pelo EXIF (autoOrient), para não trocar largura e altura.
        const { autoOrient } = await image.metadata();
        const side = Math.min(autoOrient.width, autoOrient.height, IMAGE_MAX_SIDE);
        image.resize({ width: side, height: side, fit: 'cover', position: 'centre' });
      } else {
        image.resize({ width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE, fit: 'inside', withoutEnlargement: true });
      }
      const { data, info } = await image
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return ok({ bytes: new Uint8Array(data), contentType: 'image/webp', width: info.width, height: info.height });
    } catch {
      return invalid('Não foi possível ler a imagem. Envie uma foto JPEG, PNG, WebP ou AVIF.');
    }
  }
}
