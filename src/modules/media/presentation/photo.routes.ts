import type { FarmSchemaName } from '#modules/farms';
import { IMAGE_UPLOAD, TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import { type AccessPolicies, PUBLIC_ROUTE } from '../../../http/access';
import type { PhotoController } from './photo.controller';

const farmerId = pathParam('id', 'ID do produtor.');
const workerId = pathParam('id', 'ID do trabalhador.');
const farmId = pathParam('farmId', 'ID da fazenda (ativa e do produtor da rota).');
const photoId = { name: 'photoId', in: 'path' as const, required: true, description: 'Id da foto (`farm.photos[].id`).', schema: { type: 'string' as const } };
const uploadErrors = {
  400: 'Corpo vazio, sem Content-Type image/*, ou arquivo que não é uma imagem legível.',
  413: 'Arquivo maior que 10 MB.'
};
// 'FarmerResponse' e 'WorkerResponse' ainda são do registro legado (saem com os módulos de perfis).
const photoOperation = operation<FarmSchemaName | 'FarmerResponse' | 'WorkerResponse'>;

export interface PhotoRoutes {
  // Em /api/farmers: foto de perfil do produtor e fotos das fazendas.
  farmer: readonly RouteDef[];
  farm: readonly RouteDef[];
  // Em /api/workers: foto de perfil do trabalhador.
  worker: readonly RouteDef[];
  // Em /api/images: os bytes.
  images: readonly RouteDef[];
}

export function photoRoutes(photos: PhotoController, access: AccessPolicies): PhotoRoutes {
  return {
    farmer: [
      route('post', '/:id/photo', photos.uploadFarmerPhoto, photoOperation({
        tag: TAGS.farmers,
        summary: 'Enviar foto de perfil do produtor',
        description:
          'Substitui a foto anterior. Envie a foto já recortada em quadrado; se vier em outra proporção, ' +
          'o servidor recorta o quadrado central. Reduzida para no máximo 1000×1000px e convertida para WebP, sem metadados.',
        params: [farmerId],
        body: IMAGE_UPLOAD,
        success: { status: 200, description: 'Foto salva; `photo_url` atualizado.', schema: 'FarmerResponse' },
        errors: { ...uploadErrors, 404: 'Produtor não encontrado.' }
      }), access.ownFarmer()),

      route('delete', '/:id/photo', photos.deleteFarmerPhoto, photoOperation({
        tag: TAGS.farmers,
        summary: 'Remover foto de perfil do produtor',
        params: [farmerId],
        success: { status: 200, description: 'Foto removida (`photo_url` = null).', schema: 'FarmerResponse' },
        errors: { 404: 'Produtor não encontrado.' }
      }), access.ownFarmer())
    ],
    farm: [
      route('post', '/:id/farms/:farmId/photos', photos.addFarmPhoto, photoOperation({
        tag: TAGS.farms,
        summary: 'Adicionar foto à fazenda',
        description: 'Até 6 fotos por fazenda; a primeira é a capa mostrada nas vagas. Reduzida para no máximo 1000px e convertida para WebP.',
        params: [farmerId, farmId],
        body: IMAGE_UPLOAD,
        success: { status: 201, description: 'Foto adicionada ao fim de `farm.photos`.', schema: 'FarmResponse' },
        errors: {
          ...uploadErrors,
          404: 'Produtor não encontrado; fazenda não encontrada, removida ou de outro produtor.',
          409: 'A fazenda já tem 6 fotos.'
        }
      }), access.ownFarmer()),

      route('delete', '/:id/farms/:farmId/photos/:photoId', photos.deleteFarmPhoto, photoOperation({
        tag: TAGS.farms,
        summary: 'Remover foto da fazenda',
        params: [farmerId, farmId, photoId],
        success: { status: 200, description: 'Foto removida.', schema: 'FarmResponse' },
        errors: { 404: 'Produtor, fazenda ou foto não encontrados.' }
      }), access.ownFarmer())
    ],
    worker: [
      route('post', '/:id/photo', photos.uploadWorkerPhoto, photoOperation({
        tag: TAGS.workers,
        summary: 'Enviar foto de perfil do trabalhador',
        description:
          'Substitui a foto anterior. Envie a foto já recortada em quadrado; se vier em outra proporção, ' +
          'o servidor recorta o quadrado central. Reduzida para no máximo 1000×1000px e convertida para WebP, sem metadados.',
        params: [workerId],
        body: IMAGE_UPLOAD,
        success: { status: 200, description: 'Foto salva; `photo_url` atualizado.', schema: 'WorkerResponse' },
        errors: {
          400: 'Corpo vazio, sem Content-Type image/*, ou arquivo que não é uma imagem legível.',
          404: 'Trabalhador não encontrado.',
          413: 'Arquivo maior que 10 MB.'
        }
      }), access.ownWorker()),

      route('delete', '/:id/photo', photos.deleteWorkerPhoto, photoOperation({
        tag: TAGS.workers,
        summary: 'Remover foto de perfil do trabalhador',
        params: [workerId],
        success: { status: 200, description: 'Foto removida (`photo_url` = null).', schema: 'WorkerResponse' },
        errors: { 404: 'Trabalhador não encontrado.' }
      }), access.ownWorker())
    ],
    images: [
      route('get', '/:id', photos.getImage, photoOperation({
        tag: TAGS.images,
        summary: 'Baixar imagem',
        description:
          'Fotos de perfil e de fazenda, sempre em WebP com no máximo 1000px no maior lado. ' +
          'As URLs vêm prontas nas entidades (`photo_url`, `farm.photos[].url`). Cada envio gera um id novo, ' +
          'então a resposta pode ficar em cache para sempre.',
        params: [{ name: 'id', in: 'path', required: true, description: 'Id da imagem (ex.: `3f2c….webp`).', schema: { type: 'string' } }],
        success: { status: 200, description: 'Bytes da imagem.', binary: 'image/webp' },
        errors: { 404: 'Imagem não encontrada.' }
      }), PUBLIC_ROUTE)
    ]
  };
}
