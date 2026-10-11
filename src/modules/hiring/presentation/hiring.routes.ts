import type { ServiceSchemaName } from '#modules/services';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { AccessPolicies } from '../../../http/access';
import type { HiringController } from './hiring.controller';
import type { HiringSchemaName } from './hiring.schemas';

const serviceId = pathParam('id', 'ID do serviço.');
const jobId = pathParam('id', 'ID do serviço (vaga).');
const hiringOperation = operation<HiringSchemaName | ServiceSchemaName>;

export interface HiringRoutes {
  // Em /api/farmers, junto das rotas '/services/...' (antes de '/:id').
  farmer: readonly RouteDef[];
  // Em /api/workers, junto das vagas (antes de '/:id').
  worker: readonly RouteDef[];
}

export function hiringRoutes(hiring: HiringController, access: AccessPolicies): HiringRoutes {
  return {
    farmer: [
      route('get', '/services/:id/applications', hiring.listServiceApplications, hiringOperation({
        tag: TAGS.farmerServices,
        summary: 'Candidaturas do serviço',
        params: [serviceId],
        success: { status: 200, description: 'Candidaturas com o trabalhador embutido (CPF mascarado).', schema: { listOf: 'ApplicationWithWorker' } },
        errors: { 404: 'Serviço não encontrado.' }
      }), access.farmerOfService()),

      route('get', '/services/:id/events', hiring.serviceApplicationEvents, hiringOperation({
        tag: TAGS.farmerServices,
        summary: 'Acompanhar candidaturas em tempo real (SSE)',
        description:
          'Server-Sent Events (`text/event-stream`), para usar com `EventSource` no navegador. A conexão fica aberta e ' +
          '`event: applications` (com `data: {}`) chega a cada mudança; o aviso não traz dados: busque a lista de novo em `GET /api/farmers/services/{id}/applications`. ' +
          'Avisa quando alguém se candidata ou desiste, quando uma candidatura é aceita/recusada e quando o serviço é editado, cancelado ou pago. ' +
          'A cada 25 s vai um comentário (`: ping`) para manter a conexão viva.',
        params: [serviceId],
        success: { status: 200, description: 'Stream de eventos aberto.', eventStream: true },
        errors: { 404: 'Serviço não encontrado.' }
      }), access.farmerOfService('id', { tokenInQuery: true })),

      route('patch', '/services/:id/analyze', hiring.analyzeOffer, hiringOperation({
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
      }), access.farmerOfService()),

      route('post', '/services/:id/payment', hiring.processPayment, hiringOperation({
        tag: TAGS.farmerServices,
        summary: 'Liberar pagamento (RF04)',
        description: 'Simulação: registra o pagamento do valor do serviço e o conclui (`Completed`). Nenhum dinheiro é movimentado.',
        params: [serviceId],
        success: { status: 200, description: 'Pagamento registrado e serviço concluído.', schema: 'PaymentResponse' },
        errors: { 404: 'Serviço não encontrado.', 409: 'O serviço não está `In Progress`.' }
      }), access.farmerOfService())
    ],
    worker: [
      route('post', '/services/:id/apply', hiring.applyForService, hiringOperation({
        tag: TAGS.jobs,
        summary: 'Candidatar-se (RF02)',
        params: [jobId],
        body: 'WorkerActionInput',
        success: { status: 201, description: 'Candidatura `Pending` criada.', schema: 'ApplicationResponse' },
        errors: {
          400: '`worker_id` faltando.',
          404: 'Serviço ou trabalhador não encontrados.',
          409: 'A vaga não está aberta; o prazo da vaga (`expires_at`) terminou; o trabalhador já se candidatou; o serviço foi publicado pelo perfil de produtor da mesma conta.'
        }
      }), access.workerInBody()),

      route('patch', '/services/:id/withdraw', hiring.withdrawFromService, hiringOperation({
        tag: TAGS.jobs,
        summary: 'Desistir (candidatura ou serviço aceito)',
        description:
          'Volta uma etapa:\n\n' +
          '- **Candidatura `Pending`**: é removida (pode se candidatar de novo).\n' +
          '- **Já aceito (serviço `In Progress`)**: o serviço volta a `Pending` sem trabalhador, e as candidaturas ' +
          'recusadas pelo aceite (`auto_rejected`) voltam a `Pending`. As recusadas pelo produtor continuam recusadas.',
        params: [jobId],
        body: 'WorkerActionInput',
        success: { status: 200, description: 'Desistência registrada. Traz o serviço atualizado.', schema: 'ServiceResponse' },
        errors: {
          400: '`worker_id` faltando.',
          404: 'Serviço não encontrado; o trabalhador não tem candidatura neste serviço.',
          409: 'A candidatura já foi recusada ou o serviço já foi encerrado.'
        }
      }), access.workerInBody())
    ]
  };
}
