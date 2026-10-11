import type { HiringSchemaName } from '#modules/hiring';
import type { ServiceSchemaName } from '#modules/services';
import { PDF_UPLOAD, TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import { type AccessPolicies, PUBLIC_ROUTE } from '../../../http/access';
import type { ResumeController } from './resume.controller';
import type { WorkerController } from './worker.controller';
import type { WorkerSchemaName } from './worker.schemas';

const workerId = pathParam('id', 'ID do trabalhador.');
const workerOperation = operation<WorkerSchemaName | HiringSchemaName | ServiceSchemaName>;

export interface WorkerRoutes {
  // Em /api/workers, depois das vagas: cadastro e perfil.
  profile: readonly RouteDef[];
  // Em /api/workers: o currículo.
  resume: readonly RouteDef[];
  // Em /api/workers: candidaturas, avisos em tempo real e serviços aceitos.
  tracking: readonly RouteDef[];
  // Em /api/documents: os bytes dos currículos.
  documents: readonly RouteDef[];
}

export function workerRoutes(workers: WorkerController, resumes: ResumeController, access: AccessPolicies): WorkerRoutes {
  return {
    profile: [
      route('get', '/', workers.listWorkers, workerOperation({
        tag: TAGS.workers,
        summary: 'Listar trabalhadores',
        success: { status: 200, description: 'Trabalhadores com CPF mascarado.', schema: { listOf: 'Worker' } }
      }), access.system('users:manage')),

      route('post', '/', workers.createWorker, workerOperation({
        tag: TAGS.workers,
        summary: 'Cadastrar trabalhador',
        body: 'WorkerInput',
        success: { status: 201, description: 'Trabalhador cadastrado.', schema: 'WorkerSignupResponse' },
        errors: {
          400: 'Campo obrigatório faltando; e-mail inválido; CPF inválido; senha fora do tamanho (8 a 128).',
          409: 'Já existe uma conta com este e-mail ou CPF (para ter os dois perfis, use POST /api/accounts/:id/profiles).'
        }
      }), PUBLIC_ROUTE),

      route('get', '/:id', workers.getWorker, workerOperation({
        tag: TAGS.workers,
        summary: 'Perfil do trabalhador',
        params: [workerId],
        success: { status: 200, description: 'Perfil completo (CPF sem máscara).', schema: 'Worker' },
        errors: { 404: 'Trabalhador não encontrado.' }
      }), access.ownWorker()),

      route('patch', '/:id', workers.updateWorker, workerOperation({
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

      route('delete', '/:id', workers.deleteWorker, workerOperation({
        tag: TAGS.workers,
        summary: 'Remover trabalhador',
        description: 'Remove também todas as candidaturas dele, a foto e o currículo.',
        params: [workerId],
        success: { status: 200, description: 'Trabalhador removido.', schema: 'MessageResponse' },
        errors: { 404: 'Trabalhador não encontrado.', 409: 'O trabalhador tem serviço `In Progress`.' }
      }), access.ownWorker())
    ],
    resume: [
      route('post', '/:id/resume', resumes.uploadWorkerResume, workerOperation({
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

      route('delete', '/:id/resume', resumes.deleteWorkerResume, workerOperation({
        tag: TAGS.workers,
        summary: 'Remover currículo do trabalhador',
        params: [workerId],
        success: { status: 200, description: 'Currículo removido (`resume_url` = null).', schema: 'WorkerResponse' },
        errors: { 404: 'Trabalhador não encontrado.' }
      }), access.ownWorker())
    ],
    tracking: [
      route('get', '/:id/applications', workers.listWorkerApplications, workerOperation({
        tag: TAGS.workers,
        summary: 'Candidaturas do trabalhador',
        params: [workerId],
        success: { status: 200, description: 'Candidaturas com o serviço embutido.', schema: { listOf: 'ApplicationWithService' } },
        errors: { 404: 'Trabalhador não encontrado.' }
      }), access.ownWorker()),

      route('get', '/:id/events', workers.workerApplicationEvents, workerOperation({
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

      route('get', '/:id/services', workers.listWorkerServices, workerOperation({
        tag: TAGS.workers,
        summary: 'Serviços atribuídos ao trabalhador',
        description: 'Serviços em que ele foi aceito (em andamento ou concluídos).',
        params: [workerId],
        success: { status: 200, description: 'Serviços com cidade/UF da fazenda.', schema: { listOf: 'OpenService' } },
        errors: { 404: 'Trabalhador não encontrado.' }
      }), access.ownWorker())
    ],
    documents: [
      route('get', '/:id', resumes.getDocument, workerOperation({
        tag: TAGS.documents,
        summary: 'Baixar documento',
        description:
          'Currículos em PDF dos trabalhadores, guardados como foram enviados. A URL vem pronta no trabalhador ' +
          '(`resume_url`). Cada envio gera um id novo, então a resposta pode ficar em cache para sempre.',
        params: [{ name: 'id', in: 'path', required: true, description: 'Id do documento (ex.: `3f2c….pdf`).', schema: { type: 'string' } }],
        success: { status: 200, description: 'Bytes do PDF.', binary: 'application/pdf' },
        errors: { 404: 'Documento não encontrado.' }
      }), PUBLIC_ROUTE)
    ]
  };
}
