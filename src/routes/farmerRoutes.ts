import type { HiringRoutes } from '#modules/hiring';
import type { PhotoRoutes } from '#modules/media';
import type { ServiceRoutes } from '#modules/services';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { AuthController } from '../controllers/AuthController';
import type { FarmerController } from '../controllers/FarmerController';
import { TAGS, operation, pathParam } from '../docs/operations';
import { type AccessPolicies, PUBLIC_ROUTE } from '../http/access';

// Montadas em /api/farmers. Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

const farmerId = pathParam('id', 'ID do produtor.');

export interface FarmerRouteControllers {
  farmers: FarmerController;
  auth: AuthController;
}

export function farmerRoutes(
  { farmers, auth }: FarmerRouteControllers,
  modules: { farms: readonly RouteDef[]; services: ServiceRoutes; hiring: HiringRoutes; photos: PhotoRoutes },
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

    // Foto de perfil (src/modules/media).
    ...modules.photos.farmer,

    // --- FAZENDAS ---

    // A fazenda (src/modules/farms) e as fotos dela (src/modules/media).
    ...modules.farms,
    ...modules.photos.farm,

    // --- SERVIÇOS DO PRODUTOR ---

    ...modules.services.farmerServices
  ];
}
