import type { AuthController } from '../controllers/AuthController';
import type { EventController } from '../controllers/EventController';
import type { PhotoController } from '../controllers/PhotoController';
import type { ResumeController } from '../controllers/ResumeController';
import type { WorkerController } from '../controllers/WorkerController';
import { IMAGE_UPLOAD, PDF_UPLOAD, TAGS, operation, pathParam } from '../docs/operations';
import { type AccessPolicies, PUBLIC_ROUTE } from '../http/access';
import type { HiringRoutes } from '#modules/hiring';
import type { ServiceRoutes } from '#modules/services';
import { type RouteDef, route } from '#shared/infra/http/route';

// Montadas em /api/workers. Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

const workerId = pathParam('id', 'ID do trabalhador.');

export interface WorkerRouteControllers {
  workers: WorkerController;
  photos: PhotoController;
  resumes: ResumeController;
  auth: AuthController;
  events: EventController;
}

export function workerRoutes(
  { workers, photos, resumes, auth, events }: WorkerRouteControllers,
  modules: { services: ServiceRoutes; hiring: HiringRoutes },
  access: AccessPolicies
): readonly RouteDef[] {
  return [
    // --- VAGAS ---

    // Buscar e ver (src/modules/services); candidatura e desistência (src/modules/hiring).
    ...modules.services.jobs,
    ...modules.hiring.worker,

    // --- TRABALHADORES ---

    route('get', '/', workers.listWorkers, operation({
      tag: TAGS.workers,
      summary: 'Listar trabalhadores',
      success: { status: 200, description: 'Trabalhadores com CPF mascarado.', schema: { listOf: 'Worker' } }
    }), access.system('users:manage')),

    route('post', '/', workers.createWorker, operation({
      tag: TAGS.workers,
      summary: 'Cadastrar trabalhador',
      body: 'WorkerInput',
      success: { status: 201, description: 'Trabalhador cadastrado.', schema: 'WorkerSignupResponse' },
      errors: {
        400: 'Campo obrigatório faltando; e-mail inválido; CPF inválido; senha fora do tamanho (8 a 128).',
        409: 'Já existe uma conta com este e-mail ou CPF (para ter os dois perfis, use POST /api/accounts/:id/profiles).'
      }
    }), PUBLIC_ROUTE),

    route('get', '/:id', workers.getWorker, operation({
      tag: TAGS.workers,
      summary: 'Perfil do trabalhador',
      params: [workerId],
      success: { status: 200, description: 'Perfil completo (CPF sem máscara).', schema: 'Worker' },
      errors: { 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker()),

    route('patch', '/:id', workers.updateWorker, operation({
      tag: TAGS.workers,
      summary: 'Editar trabalhador',
      description: '`id` e `cpf` não podem ser alterados; a senha muda em `PATCH /:id/password`.',
      params: [workerId],
      body: 'WorkerUpdate',
      success: { status: 200, description: 'Trabalhador atualizado.', schema: 'WorkerResponse' },
      errors: {
        400: 'Tentou alterar `id`, `cpf` ou `password`; e-mail inválido.',
        404: 'Trabalhador não encontrado.',
        409: 'E-mail já usado por outra conta.'
      }
    }), access.ownWorker()),

    route('delete', '/:id', workers.deleteWorker, operation({
      tag: TAGS.workers,
      summary: 'Remover trabalhador',
      description: 'Remove também todas as candidaturas dele, a foto e o currículo.',
      params: [workerId],
      success: { status: 200, description: 'Trabalhador removido.', schema: 'MessageResponse' },
      errors: { 404: 'Trabalhador não encontrado.', 409: 'O trabalhador tem serviço `In Progress`.' }
    }), access.ownWorker()),

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

    route('post', '/:id/photo', photos.uploadWorkerPhoto, operation({
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

    route('delete', '/:id/photo', photos.deleteWorkerPhoto, operation({
      tag: TAGS.workers,
      summary: 'Remover foto de perfil do trabalhador',
      params: [workerId],
      success: { status: 200, description: 'Foto removida (`photo_url` = null).', schema: 'WorkerResponse' },
      errors: { 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker()),

    route('post', '/:id/resume', resumes.uploadWorkerResume, operation({
      tag: TAGS.workers,
      summary: 'Enviar currículo do trabalhador',
      description: 'Substitui o currículo anterior. Só PDF; o arquivo é guardado como foi enviado.',
      params: [workerId],
      body: PDF_UPLOAD,
      success: { status: 200, description: 'Currículo salvo; `resume_url` atualizado.', schema: 'WorkerResponse' },
      errors: {
        400: 'Corpo vazio, sem Content-Type application/pdf, ou arquivo que não é um PDF.',
        404: 'Trabalhador não encontrado.',
        413: 'Arquivo maior que 5 MB.'
      }
    }), access.ownWorker()),

    route('delete', '/:id/resume', resumes.deleteWorkerResume, operation({
      tag: TAGS.workers,
      summary: 'Remover currículo do trabalhador',
      params: [workerId],
      success: { status: 200, description: 'Currículo removido (`resume_url` = null).', schema: 'WorkerResponse' },
      errors: { 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker()),

    route('get', '/:id/applications', workers.listWorkerApplications, operation({
      tag: TAGS.workers,
      summary: 'Candidaturas do trabalhador',
      params: [workerId],
      success: { status: 200, description: 'Candidaturas com o serviço embutido.', schema: { listOf: 'ApplicationWithService' } },
      errors: { 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker()),

    route('get', '/:id/events', events.workerApplicationEvents, operation({
      tag: TAGS.workers,
      summary: 'Acompanhar candidaturas em tempo real (SSE)',
      description:
        'Server-Sent Events (`text/event-stream`), para usar com `EventSource` no navegador. A conexão fica aberta e ' +
        '`event: applications` (com `data: {}`) chega a cada mudança; o aviso não traz dados: busque a lista de novo em `GET /api/workers/{id}/applications`. ' +
        'Avisa quando uma candidatura do trabalhador é aceita, recusada (pelo produtor ou pelo aceite de outro), volta a `Pending` ' +
        'ou some, e quando o serviço é editado, cancelado ou pago. A cada 25 s vai um comentário (`: ping`) para manter a conexão viva.',
      params: [workerId],
      success: { status: 200, description: 'Stream de eventos aberto.', eventStream: true },
      errors: { 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker('id', { tokenInQuery: true })),

    route('get', '/:id/services', workers.listWorkerServices, operation({
      tag: TAGS.workers,
      summary: 'Serviços atribuídos ao trabalhador',
      description: 'Serviços em que ele foi aceito (em andamento ou concluídos).',
      params: [workerId],
      success: { status: 200, description: 'Serviços com cidade/UF da fazenda.', schema: { listOf: 'OpenService' } },
      errors: { 404: 'Trabalhador não encontrado.' }
    }), access.ownWorker())
  ];
}
