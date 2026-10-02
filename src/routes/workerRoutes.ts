import type { JobController } from '../controllers/JobController';
import type { PhotoController } from '../controllers/PhotoController';
import type { WorkerController } from '../controllers/WorkerController';
import { IMAGE_UPLOAD, TAGS, operation, pathParam, queryParam } from '../docs/operations';
import { type RouteDef, route } from '../http/route';

// Montadas em /api/workers. Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

const workerId = pathParam('id', 'ID do trabalhador.');
const serviceId = pathParam('id', 'ID do serviço (vaga).');

export interface WorkerRouteControllers {
  workers: WorkerController;
  jobs: JobController;
  photos: PhotoController;
}

const date = { type: 'string' as const, format: 'date', example: '2026-10-01' };

export function workerRoutes({ workers, jobs, photos }: WorkerRouteControllers): readonly RouteDef[] {
  return [
    // --- VAGAS ---

    route('get', '/services', jobs.searchServices, operation({
      tag: TAGS.jobs,
      summary: 'Buscar vagas abertas (RF02)',
      description:
        'Serviços `Pending` dentro da validade (`expires_at` vazio ou hoje/futuro, no horário de Brasília), ' +
        'com cidade/UF e fotos da fazenda (sem o endereço completo). Todos os filtros são opcionais e se combinam.',
      params: [
        queryParam('q', 'Busca no nome, na descrição, na categoria e na cidade. Ignora acentos e maiúsculas; todas as palavras precisam aparecer.', { type: 'string', maxLength: 100 }),
        queryParam('category', 'Filtra por categoria (ver GET /api/categories).', { type: 'string' }),
        queryParam('min_hours', 'Carga horária mínima (horas).', { type: 'number', minimum: 0 }),
        queryParam('max_hours', 'Carga horária máxima (horas).', { type: 'number', minimum: 0 }),
        queryParam('from', 'Publicadas a partir deste dia.', date),
        queryParam('to', 'Publicadas até este dia.', date),
        queryParam('sort', 'Ordem. Padrão: recent.', { type: 'string', enum: ['recent', 'price_desc', 'price_asc', 'duration_asc', 'duration_desc'] })
      ],
      success: { status: 200, description: 'Vagas abertas.', schema: { listOf: 'OpenService' } },
      errors: { 400: 'Número ou data em formato inválido; mínimo maior que o máximo; `from` depois de `to`; `sort` desconhecido.' }
    })),

    route('get', '/services/:id', jobs.getServiceDetail, operation({
      tag: TAGS.jobs,
      summary: 'Detalhe da vaga',
      description: 'Retorna o serviço em qualquer status (o trabalhador acompanha as vagas em que se candidatou). Com `worker_id` do trabalhador aceito no serviço, `farm` inclui `latitude`/`longitude`.',
      params: [
        serviceId,
        queryParam('worker_id', 'Trabalhador que está vendo a vaga. Se for o aceito no serviço, recebe o ponto da fazenda no mapa.', { type: 'integer', minimum: 1 })
      ],
      success: { status: 200, description: 'Serviço com cidade/UF da fazenda (e o ponto no mapa, para o trabalhador aceito).', schema: 'OpenService' },
      errors: { 400: '`worker_id` inválido.', 404: 'Serviço não encontrado.' }
    })),

    route('post', '/services/:id/apply', jobs.applyForService, operation({
      tag: TAGS.jobs,
      summary: 'Candidatar-se (RF02)',
      params: [serviceId],
      body: 'WorkerActionInput',
      success: { status: 201, description: 'Candidatura `Pending` criada.', schema: 'ApplicationResponse' },
      errors: {
        400: '`worker_id` faltando.',
        404: 'Serviço ou trabalhador não encontrados.',
        409: 'A vaga não está aberta; o prazo da vaga (`expires_at`) terminou; o trabalhador já se candidatou.'
      }
    })),

    route('patch', '/services/:id/withdraw', jobs.withdrawFromService, operation({
      tag: TAGS.jobs,
      summary: 'Desistir (candidatura ou serviço aceito)',
      description:
        'Volta uma etapa:\n\n' +
        '- **Candidatura `Pending`**: é removida (pode se candidatar de novo).\n' +
        '- **Já aceito (serviço `In Progress`)**: o serviço volta a `Pending` sem trabalhador, e as candidaturas ' +
        'recusadas pelo aceite (`auto_rejected`) voltam a `Pending`. As recusadas pelo produtor continuam recusadas.',
      params: [serviceId],
      body: 'WorkerActionInput',
      success: { status: 200, description: 'Desistência registrada. Traz o serviço atualizado.', schema: 'ServiceResponse' },
      errors: {
        400: '`worker_id` faltando.',
        404: 'Serviço não encontrado; o trabalhador não tem candidatura neste serviço.',
        409: 'A candidatura já foi recusada ou o serviço já foi encerrado.'
      }
    })),

    // --- TRABALHADORES ---

    route('get', '/', workers.listWorkers, operation({
      tag: TAGS.workers,
      summary: 'Listar trabalhadores',
      success: { status: 200, description: 'Trabalhadores com CPF mascarado.', schema: { listOf: 'Worker' } }
    })),

    route('post', '/', workers.createWorker, operation({
      tag: TAGS.workers,
      summary: 'Cadastrar trabalhador',
      body: 'WorkerInput',
      success: { status: 201, description: 'Trabalhador cadastrado.', schema: 'WorkerResponse' },
      errors: {
        400: 'Campo obrigatório faltando; e-mail inválido; CPF inválido.',
        409: 'Já existe trabalhador com este e-mail ou CPF.'
      }
    })),

    route('get', '/:id', workers.getWorker, operation({
      tag: TAGS.workers,
      summary: 'Perfil do trabalhador',
      params: [workerId],
      success: { status: 200, description: 'Perfil completo (CPF sem máscara).', schema: 'Worker' },
      errors: { 404: 'Trabalhador não encontrado.' }
    })),

    route('patch', '/:id', workers.updateWorker, operation({
      tag: TAGS.workers,
      summary: 'Editar trabalhador',
      description: '`id` e `cpf` não podem ser alterados.',
      params: [workerId],
      body: 'WorkerUpdate',
      success: { status: 200, description: 'Trabalhador atualizado.', schema: 'WorkerResponse' },
      errors: {
        400: 'Tentou alterar `id` ou `cpf`; e-mail inválido.',
        404: 'Trabalhador não encontrado.',
        409: 'E-mail já usado por outro trabalhador.'
      }
    })),

    route('delete', '/:id', workers.deleteWorker, operation({
      tag: TAGS.workers,
      summary: 'Remover trabalhador',
      description: 'Remove também todas as candidaturas dele.',
      params: [workerId],
      success: { status: 200, description: 'Trabalhador removido.', schema: 'MessageResponse' },
      errors: { 404: 'Trabalhador não encontrado.', 409: 'O trabalhador tem serviço `In Progress`.' }
    })),

    route('post', '/:id/photo', photos.uploadWorkerPhoto, operation({
      tag: TAGS.workers,
      summary: 'Enviar foto de perfil do trabalhador',
      description: 'Substitui a foto anterior. Reduzida para no máximo 1000px e convertida para WebP, sem metadados.',
      params: [workerId],
      body: IMAGE_UPLOAD,
      success: { status: 200, description: 'Foto salva; `photo_url` atualizado.', schema: 'WorkerResponse' },
      errors: {
        400: 'Corpo vazio, sem Content-Type image/*, ou arquivo que não é uma imagem legível.',
        404: 'Trabalhador não encontrado.',
        413: 'Arquivo maior que 10 MB.'
      }
    })),

    route('delete', '/:id/photo', photos.deleteWorkerPhoto, operation({
      tag: TAGS.workers,
      summary: 'Remover foto de perfil do trabalhador',
      params: [workerId],
      success: { status: 200, description: 'Foto removida (`photo_url` = null).', schema: 'WorkerResponse' },
      errors: { 404: 'Trabalhador não encontrado.' }
    })),

    route('get', '/:id/applications', workers.listWorkerApplications, operation({
      tag: TAGS.workers,
      summary: 'Candidaturas do trabalhador',
      params: [workerId],
      success: { status: 200, description: 'Candidaturas com o serviço embutido.', schema: { listOf: 'ApplicationWithService' } },
      errors: { 404: 'Trabalhador não encontrado.' }
    })),

    route('get', '/:id/services', workers.listWorkerServices, operation({
      tag: TAGS.workers,
      summary: 'Serviços atribuídos ao trabalhador',
      description: 'Serviços em que ele foi aceito (em andamento ou concluídos).',
      params: [workerId],
      success: { status: 200, description: 'Serviços com cidade/UF da fazenda.', schema: { listOf: 'OpenService' } },
      errors: { 404: 'Trabalhador não encontrado.' }
    }))
  ];
}
