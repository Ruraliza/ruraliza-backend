import * as WorkerController from '../controllers/WorkerController';
import { TAGS, operation, pathParam, queryParam } from '../docs/operations';
import { type RouteDef, route } from '../http/route';

// Montadas em /api/workers. Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

const workerId = pathParam('id', 'ID do trabalhador.');
const serviceId = pathParam('id', 'ID do serviço (vaga).');

export const workerRoutes: readonly RouteDef[] = [
  // --- VAGAS ---

  route('get', '/services', WorkerController.searchServices, operation({
    tag: TAGS.jobs,
    summary: 'Buscar vagas abertas (RF02)',
    description: 'Serviços `Pending`, com cidade/UF da fazenda (sem o endereço completo).',
    params: [queryParam('category', 'Filtra por categoria (ver GET /api/categories).', { type: 'string' })],
    success: { status: 200, description: 'Vagas abertas.', schema: { listOf: 'OpenService' } }
  })),

  route('get', '/services/:id', WorkerController.getServiceDetail, operation({
    tag: TAGS.jobs,
    summary: 'Detalhe da vaga',
    description: 'Retorna o serviço em qualquer status (o trabalhador acompanha as vagas em que se candidatou).',
    params: [serviceId],
    success: { status: 200, description: 'Serviço com cidade/UF da fazenda.', schema: 'OpenService' },
    errors: { 404: 'Serviço não encontrado.' }
  })),

  route('post', '/services/:id/apply', WorkerController.applyForService, operation({
    tag: TAGS.jobs,
    summary: 'Candidatar-se (RF02)',
    params: [serviceId],
    body: 'WorkerActionInput',
    success: { status: 201, description: 'Candidatura `Pending` criada.', schema: 'ApplicationResponse' },
    errors: {
      400: '`worker_id` faltando.',
      404: 'Serviço ou trabalhador não encontrados.',
      409: 'A vaga não está aberta; o trabalhador já se candidatou.'
    }
  })),

  route('patch', '/services/:id/withdraw', WorkerController.withdrawFromService, operation({
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

  route('get', '/', WorkerController.listWorkers, operation({
    tag: TAGS.workers,
    summary: 'Listar trabalhadores',
    success: { status: 200, description: 'Trabalhadores com CPF mascarado.', schema: { listOf: 'Worker' } }
  })),

  route('post', '/', WorkerController.createWorker, operation({
    tag: TAGS.workers,
    summary: 'Cadastrar trabalhador',
    body: 'WorkerInput',
    success: { status: 201, description: 'Trabalhador cadastrado.', schema: 'WorkerResponse' },
    errors: {
      400: 'Campo obrigatório faltando; e-mail inválido; CPF inválido.',
      409: 'Já existe trabalhador com este e-mail ou CPF.'
    }
  })),

  route('get', '/:id', WorkerController.getWorker, operation({
    tag: TAGS.workers,
    summary: 'Perfil do trabalhador',
    params: [workerId],
    success: { status: 200, description: 'Perfil completo (CPF sem máscara).', schema: 'Worker' },
    errors: { 404: 'Trabalhador não encontrado.' }
  })),

  route('patch', '/:id', WorkerController.updateWorker, operation({
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

  route('delete', '/:id', WorkerController.deleteWorker, operation({
    tag: TAGS.workers,
    summary: 'Remover trabalhador',
    description: 'Remove também todas as candidaturas dele.',
    params: [workerId],
    success: { status: 200, description: 'Trabalhador removido.', schema: 'MessageResponse' },
    errors: { 404: 'Trabalhador não encontrado.', 409: 'O trabalhador tem serviço `In Progress`.' }
  })),

  route('get', '/:id/applications', WorkerController.listWorkerApplications, operation({
    tag: TAGS.workers,
    summary: 'Candidaturas do trabalhador',
    params: [workerId],
    success: { status: 200, description: 'Candidaturas com o serviço embutido.', schema: { listOf: 'ApplicationWithService' } },
    errors: { 404: 'Trabalhador não encontrado.' }
  })),

  route('get', '/:id/services', WorkerController.listWorkerServices, operation({
    tag: TAGS.workers,
    summary: 'Serviços atribuídos ao trabalhador',
    description: 'Serviços em que ele foi aceito (em andamento ou concluídos).',
    params: [workerId],
    success: { status: 200, description: 'Serviços com cidade/UF da fazenda.', schema: { listOf: 'OpenService' } },
    errors: { 404: 'Trabalhador não encontrado.' }
  }))
];
