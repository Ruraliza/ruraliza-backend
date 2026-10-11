import type { HiringRoutes } from '#modules/hiring';
import type { PhotoRoutes } from '#modules/media';
import type { ServiceRoutes } from '#modules/services';
import type { WorkerRoutes } from '#modules/workers';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { AuthController } from '../controllers/AuthController';
import { TAGS, operation, pathParam } from '../docs/operations';
import type { AccessPolicies } from '../http/access';

// Montadas em /api/workers. Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

const workerId = pathParam('id', 'ID do trabalhador.');

export interface WorkerRouteControllers {
  auth: AuthController;
}

export function workerRoutes(
  { auth }: WorkerRouteControllers,
  modules: { services: ServiceRoutes; hiring: HiringRoutes; photos: PhotoRoutes; workers: WorkerRoutes },
  access: AccessPolicies
): readonly RouteDef[] {
  return [
    // --- VAGAS ---

    // Buscar e ver (src/modules/services); candidatura e desistência (src/modules/hiring).
    ...modules.services.jobs,
    ...modules.hiring.worker,

    // --- TRABALHADORES ---

    // Cadastro e perfil (src/modules/workers).
    ...modules.workers.profile,

    route('patch', '/:id/password', auth.changeWorkerPassword, operation({
      tag: TAGS.workers,
      summary: 'Trocar a senha (com a conta aberta)',
      description: 'Confirma a senha atual; não precisa de código por e-mail. Cancela uma redefinição de senha pendente.',
      params: [workerId],
      body: 'PasswordChangeInput',
      success: { status: 200, description: 'Senha trocada.', schema: 'MessageResponse' },
      errors: {
        400: 'Campo obrigatório faltando; nova senha fora do tamanho (8 a 128) ou igual à atual.',
        401: 'A senha atual está incorreta.',
        404: 'Trabalhador não encontrado.'
      }
    }), access.ownWorker()),

    // Foto de perfil (src/modules/media); currículo, candidaturas, avisos e serviços (src/modules/workers).
    ...modules.photos.worker,
    ...modules.workers.resume,
    ...modules.workers.tracking
  ];
}
