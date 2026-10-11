import type { AccessPolicies } from '#modules/auth';
import { TAGS, operation, pathParam, queryParam } from '#shared/infra/docs/operations';
import { type RefTo, refTo } from '#shared/infra/docs/schema-kit';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { JobController } from './job.controller';
import type { ServiceController } from './service.controller';
import type { ServiceSchemaName } from './service.schemas';

const farmerId = pathParam('id', 'ID do produtor.');
const serviceId = pathParam('id', 'ID do serviço.');
const jobId = pathParam('id', 'ID do serviço (vaga).');
const date = { type: 'string' as const, format: 'date', example: '2026-10-01' };
const serviceOperation = operation<ServiceSchemaName>;
const ref: RefTo<ServiceSchemaName> = refTo;

export interface ServiceRoutes {
  // Em /api/farmers, antes de '/:id' (senão '/services/1' casaria com '/:id').
  services: readonly RouteDef[];
  // Em /api/farmers: os serviços de um produtor ('/:id/services').
  farmerServices: readonly RouteDef[];
  // Em /api/workers, antes de '/:id': as vagas.
  jobs: readonly RouteDef[];
}

export function serviceRoutes(services: ServiceController, jobs: JobController, access: AccessPolicies): ServiceRoutes {
  return {
    services: [
      route('post', '/services', services.requestService, serviceOperation({
        tag: TAGS.farmerServices,
        summary: 'Publicar serviço (RF01)',
        description: 'Cria um serviço `Pending` numa fazenda ativa do produtor.',
        body: 'ServiceInput',
        success: { status: 201, description: 'Serviço publicado.', schema: 'ServiceResponse' },
        errors: {
          400: 'Campo obrigatório faltando; `duration` ou `price` não é número maior que zero; fazenda de outro produtor.',
          404: 'Produtor não encontrado; fazenda não encontrada ou removida.'
        }
      }), access.farmerInBody()),

      route('get', '/services/:id', services.getService, serviceOperation({
        tag: TAGS.farmerServices,
        summary: 'Detalhe do serviço com a fazenda',
        params: [serviceId],
        success: { status: 200, description: 'Serviço com a fazenda completa (mesmo que removida).', schema: 'ServiceWithFarm' },
        errors: { 404: 'Serviço não encontrado.' }
      }), access.farmerOfService()),

      route('patch', '/services/:id', services.updateService, serviceOperation({
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
      }), access.farmerOfService()),

      route('patch', '/services/:id/cancel', services.cancelService, serviceOperation({
        tag: TAGS.farmerServices,
        summary: 'Cancelar serviço',
        description: 'Só enquanto `Pending`. O serviço vira `Cancelled`, sai das vagas e as candidaturas pendentes são recusadas.',
        params: [serviceId],
        success: { status: 200, description: 'Serviço cancelado.', schema: 'ServiceResponse' },
        errors: { 404: 'Serviço não encontrado.', 409: 'O serviço não está mais `Pending`.' }
      }), access.farmerOfService())
    ],
    farmerServices: [
      route('get', '/:id/services', services.listFarmerServices, serviceOperation({
        tag: TAGS.farmerServices,
        summary: 'Serviços do produtor',
        params: [farmerId, queryParam('status', 'Filtra por status.', ref('ServiceStatus'))],
        success: {
          status: 200,
          description: 'Serviços com a fazenda e a contagem de candidaturas pendentes.',
          schema: { listOf: 'FarmerServiceItem' }
        },
        errors: { 400: '`status` inválido.', 404: 'Produtor não encontrado.' }
      }), access.ownFarmer())
    ],
    jobs: [
      route('get', '/services', jobs.searchServices, serviceOperation({
        tag: TAGS.jobs,
        summary: 'Buscar vagas abertas (RF02)',
        description:
          'Serviços `Pending` dentro da validade (`expires_at` vazio ou hoje/futuro, no horário de Brasília), ' +
          'com cidade/UF, fotos e reputação da fazenda (sem o endereço completo). Todos os filtros são opcionais e se combinam.',
        params: [
          queryParam('q', 'Busca no nome, na descrição, na categoria e na cidade. Ignora acentos e maiúsculas; todas as palavras precisam aparecer.', { type: 'string', maxLength: 100 }),
          queryParam('category', 'Filtra por categoria (ver GET /api/categories).', { type: 'string' }),
          queryParam('min_hours', 'Carga horária mínima (horas).', { type: 'number', minimum: 0 }),
          queryParam('max_hours', 'Carga horária máxima (horas).', { type: 'number', minimum: 0 }),
          queryParam('from', 'Publicadas a partir deste dia.', date),
          queryParam('to', 'Publicadas até este dia.', date),
          queryParam('min_rating', 'Só fazendas com média de avaliação a partir desta nota (fazendas sem avaliação ficam de fora).', { type: 'number', minimum: 1, maximum: 5 }),
          queryParam('sort', 'Ordem. Padrão: recent. `rating`: fazendas mais bem avaliadas primeiro (média ponderada pela quantidade de avaliações).', { type: 'string', enum: ['recent', 'price_desc', 'price_asc', 'duration_asc', 'duration_desc', 'rating'] })
        ],
        success: { status: 200, description: 'Vagas abertas.', schema: { listOf: 'OpenService' } },
        errors: { 400: 'Número ou data em formato inválido; mínimo maior que o máximo; `from` depois de `to`; `min_rating` fora de 1 a 5; `sort` desconhecido.' }
      }), access.worker()),

      route('get', '/services/:id', jobs.getServiceDetail, serviceOperation({
        tag: TAGS.jobs,
        summary: 'Detalhe da vaga',
        description: 'Retorna o serviço em qualquer status (o trabalhador acompanha as vagas em que se candidatou). Com `worker_id` do trabalhador aceito no serviço, `farm` inclui `latitude`/`longitude`.',
        params: [
          jobId,
          queryParam('worker_id', 'Trabalhador que está vendo a vaga. Se for o aceito no serviço, recebe o ponto da fazenda no mapa.', { type: 'integer', minimum: 1 })
        ],
        success: { status: 200, description: 'Serviço com cidade/UF da fazenda (e o ponto no mapa, para o trabalhador aceito).', schema: 'OpenService' },
        errors: { 400: '`worker_id` inválido.', 404: 'Serviço não encontrado.' }
      }), access.worker())
    ]
  };
}
