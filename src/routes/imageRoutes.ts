import type { PhotoController } from '../controllers/PhotoController';
import { TAGS, operation } from '../docs/operations';
import { type RouteDef, route } from '../http/route';

// Montadas em /api/images.
export function imageRoutes(photos: PhotoController): readonly RouteDef[] {
  return [
    route('get', '/:id', photos.getImage, operation({
      tag: TAGS.images,
      summary: 'Baixar imagem',
      description:
        'Fotos de perfil e de fazenda, sempre em WebP com no máximo 1000px no maior lado. ' +
        'As URLs vêm prontas nas entidades (`photo_url`, `farm.photos[].url`). Cada envio gera um id novo, ' +
        'então a resposta pode ficar em cache para sempre.',
      params: [{ name: 'id', in: 'path', required: true, description: 'Id da imagem (ex.: `3f2c….webp`).', schema: { type: 'string' } }],
      success: { status: 200, description: 'Bytes da imagem.', binary: 'image/webp' },
      errors: { 404: 'Imagem não encontrada.' }
    }))
  ];
}
