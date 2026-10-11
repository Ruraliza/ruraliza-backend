import type { HiringRoutes } from '#modules/hiring';
import type { PhotoRoutes } from '#modules/media';
import type { ServiceRoutes } from '#modules/services';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { AuthController } from '../controllers/AuthController';
import { TAGS, operation, pathParam } from '../docs/operations';
import type { AccessPolicies } from '../http/access';

// Montadas em /api/farmers. Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

const farmerId = pathParam('id', 'ID do produtor.');

export interface FarmerRouteControllers {
  auth: AuthController;
}

export function farmerRoutes(
  { auth }: FarmerRouteControllers,
  modules: { farmers: readonly RouteDef[]; farms: readonly RouteDef[]; services: ServiceRoutes; hiring: HiringRoutes; photos: PhotoRoutes },
  access: AccessPolicies
): readonly RouteDef[] {
  return [
    // --- SERVIÇOS ---

    // Publicar, ver, editar e cancelar (src/modules/services); candidaturas, aceite e pagamento (src/modules/hiring).
    ...modules.services.services,
    ...modules.hiring.farmer,

    // --- PRODUTORES ---

    // Cadastro e perfil (src/modules/farmers).
    ...modules.farmers,

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
