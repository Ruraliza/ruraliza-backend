import * as FarmerController from '../controllers/FarmerController';
import { TAGS, operation, pathParam, queryParam } from '../docs/operations';
import { ref } from '../docs/schemas';
import { type RouteDef, route } from '../http/route';

// Montadas em /api/farmers. Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

const farmerId = pathParam('id', 'ID do produtor.');
const serviceId = pathParam('id', 'ID do serviço.');
const farmId = pathParam('farmId', 'ID da fazenda (ativa e do produtor da rota).');

export const farmerRoutes: readonly RouteDef[] = [
  // --- SERVIÇOS ---

  route('post', '/services', FarmerController.requestService, operation({
    tag: TAGS.farmerServices,
    summary: 'Publicar serviço (RF01)',
    description: 'Cria um serviço `Pending` numa fazenda ativa do produtor.',
    body: 'ServiceInput',
    success: { status: 201, description: 'Serviço publicado.', schema: 'ServiceResponse' },
    errors: {
      400: 'Campo obrigatório faltando; `duration` ou `price` não é número maior que zero; fazenda de outro produtor.',
      404: 'Produtor não encontrado; fazenda não encontrada ou removida.'
    }
  })),

  route('get', '/services/:id', FarmerController.getService, operation({
    tag: TAGS.farmerServices,
    summary: 'Detalhe do serviço com a fazenda',
    params: [serviceId],
    success: { status: 200, description: 'Serviço com a fazenda completa (mesmo que removida).', schema: 'ServiceWithFarm' },
    errors: { 404: 'Serviço não encontrado.' }
  })),

  route('patch', '/services/:id', FarmerController.updateService, operation({
    tag: TAGS.farmerServices,
    summary: 'Editar serviço',
    description: 'Só enquanto o serviço está `Pending` (sem trabalhador aceito).',
    params: [serviceId],
    body: 'ServiceUpdate',
    success: { status: 200, description: 'Serviço atualizado.', schema: 'ServiceResponse' },
    errors: {
      400: 'Tentou alterar `farmer_id`, `worker_id`, `payment_id` ou `status`; nome ou categoria vazios; duração ou valor inválidos; fazenda de outro produtor.',
      404: 'Serviço não encontrado; fazenda não encontrada ou removida.',
      409: 'O serviço não está mais `Pending`.'
    }
  })),

  route('patch', '/services/:id/cancel', FarmerController.cancelService, operation({
    tag: TAGS.farmerServices,
    summary: 'Cancelar serviço',
    description: 'Só enquanto `Pending`. O serviço vira `Cancelled`, sai das vagas e as candidaturas pendentes são recusadas.',
    params: [serviceId],
    success: { status: 200, description: 'Serviço cancelado.', schema: 'ServiceResponse' },
    errors: { 404: 'Serviço não encontrado.', 409: 'O serviço não está mais `Pending`.' }
  })),

  route('get', '/services/:id/applications', FarmerController.listServiceApplications, operation({
    tag: TAGS.farmerServices,
    summary: 'Candidaturas do serviço',
    params: [serviceId],
    success: { status: 200, description: 'Candidaturas com o trabalhador embutido (CPF mascarado).', schema: { listOf: 'ApplicationWithWorker' } },
    errors: { 404: 'Serviço não encontrado.' }
  })),

  route('patch', '/services/:id/analyze', FarmerController.analyzeOffer, operation({
    tag: TAGS.farmerServices,
    summary: 'Aceitar ou recusar candidatura (RF03)',
    description:
      '**Accept**: a candidatura é aceita, o serviço vai para `In Progress` com o trabalhador, e as demais pendentes são recusadas (`auto_rejected`).\n\n' +
      '**Reject**: só a candidatura é recusada.',
    params: [serviceId],
    body: 'AnalyzeInput',
    success: { status: 200, description: 'Candidatura analisada. No Accept, traz também o serviço.', schema: 'AnalyzeResponse' },
    errors: {
      400: '`action` diferente de Accept/Reject; `application_id` faltando; candidatura de outro serviço.',
      404: 'Serviço ou candidatura não encontrados.',
      409: 'O serviço não está mais `Pending`; a candidatura já foi analisada.'
    }
  })),

  route('post', '/services/:id/payment', FarmerController.processPayment, operation({
    tag: TAGS.farmerServices,
    summary: 'Liberar pagamento (RF04)',
    description: 'Simulação: registra o pagamento do valor do serviço e o conclui (`Completed`). Nenhum dinheiro é movimentado.',
    params: [serviceId],
    success: { status: 200, description: 'Pagamento registrado e serviço concluído.', schema: 'PaymentResponse' },
    errors: { 404: 'Serviço não encontrado.', 409: 'O serviço não está `In Progress`.' }
  })),

  // --- PRODUTORES ---

  route('get', '/', FarmerController.listFarmers, operation({
    tag: TAGS.farmers,
    summary: 'Listar produtores',
    success: { status: 200, description: 'Produtores com CPF mascarado.', schema: { listOf: 'Farmer' } }
  })),

  route('post', '/', FarmerController.createFarmer, operation({
    tag: TAGS.farmers,
    summary: 'Cadastrar produtor',
    body: 'FarmerInput',
    success: { status: 201, description: 'Produtor cadastrado.', schema: 'FarmerResponse' },
    errors: {
      400: 'Campo obrigatório faltando; e-mail inválido; CPF inválido.',
      409: 'Já existe produtor com este e-mail ou CPF.'
    }
  })),

  route('get', '/:id', FarmerController.getFarmer, operation({
    tag: TAGS.farmers,
    summary: 'Perfil do produtor',
    params: [farmerId],
    success: { status: 200, description: 'Perfil completo (CPF sem máscara).', schema: 'Farmer' },
    errors: { 404: 'Produtor não encontrado.' }
  })),

  route('patch', '/:id', FarmerController.updateFarmer, operation({
    tag: TAGS.farmers,
    summary: 'Editar produtor',
    description: '`id` e `cpf` não podem ser alterados.',
    params: [farmerId],
    body: 'FarmerUpdate',
    success: { status: 200, description: 'Produtor atualizado.', schema: 'FarmerResponse' },
    errors: {
      400: 'Tentou alterar `id` ou `cpf`; e-mail inválido.',
      404: 'Produtor não encontrado.',
      409: 'E-mail já usado por outro produtor.'
    }
  })),

  route('delete', '/:id', FarmerController.deleteFarmer, operation({
    tag: TAGS.farmers,
    summary: 'Remover produtor',
    description: 'Remove também as fazendas, os serviços e as candidaturas desses serviços. Pagamentos ficam como histórico.',
    params: [farmerId],
    success: { status: 200, description: 'Produtor removido.', schema: 'MessageResponse' },
    errors: { 404: 'Produtor não encontrado.', 409: 'O produtor tem serviço `In Progress`.' }
  })),

  // --- FAZENDAS ---

  route('get', '/:id/farms', FarmerController.listFarms, operation({
    tag: TAGS.farms,
    summary: 'Fazendas do produtor',
    description: 'Só as fazendas ativas (as removidas não aparecem).',
    params: [farmerId],
    success: { status: 200, description: 'Fazendas ativas.', schema: { listOf: 'Farm' } },
    errors: { 404: 'Produtor não encontrado.' }
  })),

  route('post', '/:id/farms', FarmerController.createFarm, operation({
    tag: TAGS.farms,
    summary: 'Cadastrar fazenda',
    params: [farmerId],
    body: 'FarmInput',
    success: { status: 201, description: 'Fazenda cadastrada e adicionada a `farmer.farms`.', schema: 'FarmResponse' },
    errors: { 400: 'Campo obrigatório faltando.', 404: 'Produtor não encontrado.' }
  })),

  route('patch', '/:id/farms/:farmId', FarmerController.updateFarm, operation({
    tag: TAGS.farms,
    summary: 'Editar fazenda',
    params: [farmerId, farmId],
    body: 'FarmUpdate',
    success: { status: 200, description: 'Fazenda atualizada.', schema: 'FarmResponse' },
    errors: {
      400: 'Tentou alterar `id` ou `farmer_id`; campo enviado vazio.',
      404: 'Produtor não encontrado; fazenda não encontrada, removida ou de outro produtor.'
    }
  })),

  route('delete', '/:id/farms/:farmId', FarmerController.deleteFarm, operation({
    tag: TAGS.farms,
    summary: 'Remover fazenda',
    description:
      'A fazenda é arquivada (`deleted_at`): sai das listas e de `farmer.farms` e não recebe mais serviços, ' +
      'mas os serviços encerrados continuam mostrando onde aconteceram.',
    params: [farmerId, farmId],
    success: { status: 200, description: 'Fazenda removida.', schema: 'MessageResponse' },
    errors: {
      404: 'Produtor não encontrado; fazenda não encontrada, já removida ou de outro produtor.',
      409: 'A fazenda tem serviço `Pending` ou `In Progress`.'
    }
  })),

  // --- SERVIÇOS DO PRODUTOR ---

  route('get', '/:id/services', FarmerController.listFarmerServices, operation({
    tag: TAGS.farmerServices,
    summary: 'Serviços do produtor',
    params: [farmerId, queryParam('status', 'Filtra por status.', ref('ServiceStatus'))],
    success: {
      status: 200,
      description: 'Serviços com a fazenda e a contagem de candidaturas pendentes.',
      schema: { listOf: 'FarmerServiceItem' }
    },
    errors: { 400: '`status` inválido.', 404: 'Produtor não encontrado.' }
  }))
];
