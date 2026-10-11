import type { AuthController } from '../controllers/AuthController';
import type { FarmerController } from '../controllers/FarmerController';
import type { PhotoController } from '../controllers/PhotoController';
import { IMAGE_UPLOAD, TAGS, operation, pathParam } from '../docs/operations';
import { type AccessPolicies, PUBLIC_ROUTE } from '../http/access';
import type { HiringRoutes } from '#modules/hiring';
import type { ServiceRoutes } from '#modules/services';
import { type RouteDef, route } from '#shared/infra/http/route';

// Montadas em /api/farmers. Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

const farmerId = pathParam('id', 'ID do produtor.');
const farmId = pathParam('farmId', 'ID da fazenda (ativa e do produtor da rota).');
const photoId = { name: 'photoId', in: 'path' as const, required: true, description: 'Id da foto (`farm.photos[].id`).', schema: { type: 'string' as const } };
const uploadErrors = {
  400: 'Corpo vazio, sem Content-Type image/*, ou arquivo que não é uma imagem legível.',
  413: 'Arquivo maior que 10 MB.'
};

export interface FarmerRouteControllers {
  farmers: FarmerController;
  photos: PhotoController;
  auth: AuthController;
}

export function farmerRoutes(
  { farmers, photos, auth }: FarmerRouteControllers,
  modules: { farms: readonly RouteDef[]; services: ServiceRoutes; hiring: HiringRoutes },
  access: AccessPolicies
): readonly RouteDef[] {
  return [
    // --- SERVIÇOS ---

    // Publicar, ver, editar e cancelar (src/modules/services); candidaturas, aceite e pagamento (src/modules/hiring).
    ...modules.services.services,
    ...modules.hiring.farmer,

    // --- PRODUTORES ---

    route('get', '/', farmers.listFarmers, operation({
      tag: TAGS.farmers,
      summary: 'Listar produtores',
      success: { status: 200, description: 'Produtores com CPF mascarado.', schema: { listOf: 'Farmer' } }
    }), access.system('users:manage')),

    route('post', '/', farmers.createFarmer, operation({
      tag: TAGS.farmers,
      summary: 'Cadastrar produtor',
      body: 'FarmerInput',
      success: { status: 201, description: 'Produtor cadastrado.', schema: 'FarmerSignupResponse' },
      errors: {
        400: 'Campo obrigatório faltando; e-mail inválido; CPF inválido; senha fora do tamanho (8 a 128).',
        409: 'Já existe uma conta com este e-mail ou CPF (para ter os dois perfis, use POST /api/accounts/:id/profiles).'
      }
    }), PUBLIC_ROUTE),

    route('get', '/:id', farmers.getFarmer, operation({
      tag: TAGS.farmers,
      summary: 'Perfil do produtor',
      params: [farmerId],
      success: { status: 200, description: 'Perfil completo (CPF sem máscara).', schema: 'Farmer' },
      errors: { 404: 'Produtor não encontrado.' }
    }), access.ownFarmer()),

    route('patch', '/:id', farmers.updateFarmer, operation({
      tag: TAGS.farmers,
      summary: 'Editar produtor',
      description: '`id` e `cpf` não podem ser alterados; a senha muda em `PATCH /:id/password`.',
      params: [farmerId],
      body: 'FarmerUpdate',
      success: { status: 200, description: 'Produtor atualizado.', schema: 'FarmerResponse' },
      errors: {
        400: 'Tentou alterar `id`, `cpf` ou `password`; e-mail inválido.',
        404: 'Produtor não encontrado.',
        409: 'E-mail já usado por outra conta.'
      }
    }), access.ownFarmer()),

    route('delete', '/:id', farmers.deleteFarmer, operation({
      tag: TAGS.farmers,
      summary: 'Remover produtor',
      description: 'Remove também as fazendas, os serviços e as candidaturas desses serviços. Pagamentos ficam como histórico.',
      params: [farmerId],
      success: { status: 200, description: 'Produtor removido.', schema: 'MessageResponse' },
      errors: { 404: 'Produtor não encontrado.', 409: 'O produtor tem serviço `In Progress`.' }
    }), access.ownFarmer()),

    route('patch', '/:id/password', auth.changeFarmerPassword, operation({
      tag: TAGS.farmers,
      summary: 'Trocar a senha (com a conta aberta)',
      description: 'Confirma a senha atual; não precisa de código por e-mail. Cancela uma redefinição de senha pendente.',
      params: [farmerId],
      body: 'PasswordChangeInput',
      success: { status: 200, description: 'Senha trocada.', schema: 'MessageResponse' },
      errors: {
        400: 'Campo obrigatório faltando; nova senha fora do tamanho (8 a 128) ou igual à atual.',
        401: 'A senha atual está incorreta.',
        404: 'Produtor não encontrado.'
      }
    }), access.ownFarmer()),

    route('post', '/:id/photo', photos.uploadFarmerPhoto, operation({
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

    route('delete', '/:id/photo', photos.deleteFarmerPhoto, operation({
      tag: TAGS.farmers,
      summary: 'Remover foto de perfil do produtor',
      params: [farmerId],
      success: { status: 200, description: 'Foto removida (`photo_url` = null).', schema: 'FarmerResponse' },
      errors: { 404: 'Produtor não encontrado.' }
    }), access.ownFarmer()),

    // --- FAZENDAS ---

    // As da fazenda em si vêm do módulo (src/modules/farms); as fotos da fazenda continuam aqui.
    ...modules.farms,

    route('post', '/:id/farms/:farmId/photos', photos.addFarmPhoto, operation({
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

    route('delete', '/:id/farms/:farmId/photos/:photoId', photos.deleteFarmPhoto, operation({
      tag: TAGS.farms,
      summary: 'Remover foto da fazenda',
      params: [farmerId, farmId, photoId],
      success: { status: 200, description: 'Foto removida.', schema: 'FarmResponse' },
      errors: { 404: 'Produtor, fazenda ou foto não encontrados.' }
    }), access.ownFarmer()),

    // --- SERVIÇOS DO PRODUTOR ---

    ...modules.services.farmerServices
  ];
}
