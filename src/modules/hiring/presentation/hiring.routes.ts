import type { AccessPolicies } from '#modules/auth';
import type { ServiceSchemaName } from '#modules/services';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { HiringController } from './hiring.controller';
import type { HiringSchemaName } from './hiring.schemas';

const serviceId = pathParam('id', 'ID do serviço.');
const chatId = pathParam('id', 'ID da conversa.');
const jobId = pathParam('id', 'ID do serviço (vaga).');
const hiringOperation = operation<HiringSchemaName | ServiceSchemaName>;

export interface HiringRoutes {
  // Em /api/farmers, junto das rotas '/services/...' (antes de '/:id').
  farmer: readonly RouteDef[];
  // Em /api/workers, junto das vagas (antes de '/:id').
  worker: readonly RouteDef[];
  // Em /api/chats: as propostas da conversa.
  chats: readonly RouteDef[];
}

export function hiringRoutes(hiring: HiringController, access: AccessPolicies): HiringRoutes {
  return {
    chats: [
      route('post', '/:id/proposals', hiring.propose, hiringOperation({
        tag: TAGS.chat,
        summary: 'Fazer uma proposta',
        description:
          'Valor combinado na conversa (`amount` por `unit`; o pagamento é liberado pelo produtor no app, no fim do serviço). Qualquer lado propõe enquanto a conversa ' +
          'está aberta, a vaga está `Pending` e a candidatura aguarda resposta. A proposta nova substitui a pendente (`Superseded`). Depois de ' +
          'uma proposta aceita, não há outra. A proposta aparece na conversa (mensagem com `proposal_id`) e o outro lado recebe push.',
        params: [chatId],
        body: 'ProposalInput',
        success: { status: 201, description: 'Proposta `Pending` criada.', schema: 'ProposalResponse' },
        errors: {
          400: 'Valor ou unidade inválidos; observações longas demais ou com palavras não permitidas.',
          404: 'Conversa não encontrada.',
          409: 'A conversa foi encerrada; a vaga ou a candidatura não estão mais aguardando; já existe uma proposta aceita.'
        }
      }), access.chatParticipant()),

      route('patch', '/:id/proposals/:proposalId', hiring.answerProposal, hiringOperation({
        tag: TAGS.chat,
        summary: 'Aceitar ou recusar a proposta',
        description:
          'Só o outro lado responde (quem propôs não aceita a própria proposta). A aceita não muda mais e libera o aceite da candidatura ' +
          '(`PATCH /api/farmers/services/{id}/analyze`). A resposta aparece na conversa, e quem propôs recebe push.',
        params: [chatId, pathParam('proposalId', 'ID da proposta.')],
        body: 'ProposalAnswerInput',
        success: { status: 200, description: 'Proposta respondida.', schema: 'ProposalResponse' },
        errors: {
          400: "`action` diferente de 'Accept'/'Decline'.",
          404: 'Conversa ou proposta (desta conversa) não encontrada.',
          409: 'Quem responde é quem propôs; a proposta não está mais pendente; a conversa foi encerrada; a vaga ou a candidatura não estão mais aguardando.'
        }
      }), access.chatParticipant())
    ],
    farmer: [
      route('get', '/services/:id/applications', hiring.listServiceApplications, hiringOperation({
        tag: TAGS.farmerServices,
        summary: 'Candidaturas do serviço',
        params: [serviceId],
        success: { status: 200, description: 'Candidaturas com o trabalhador (CPF, telefone e e-mail mascarados) e a reputação dele.', schema: { listOf: 'ApplicationWithWorker' } },
        errors: { 404: 'Serviço não encontrado.' }
      }), access.farmerOfService()),

      route('get', '/services/:id/events', hiring.serviceApplicationEvents, hiringOperation({
        tag: TAGS.farmerServices,
        summary: 'Acompanhar candidaturas em tempo real (SSE)',
        description:
          'Server-Sent Events (`text/event-stream`), para usar com `EventSource` no navegador. A conexão fica aberta e ' +
          '`event: applications` (com `data: {}`) chega a cada mudança; o aviso não traz dados: busque a lista de novo em `GET /api/farmers/services/{id}/applications`. ' +
          'Avisa quando alguém se candidata ou desiste, quando uma candidatura é aceita/recusada e quando chega ou é respondida uma proposta e quando o serviço é editado, cancelado ou pago. ' +
          'A cada 25 s vai um comentário (`: ping`) para manter a conexão viva.',
        params: [serviceId],
        success: { status: 200, description: 'Stream de eventos aberto.', eventStream: true },
        errors: { 404: 'Serviço não encontrado.' }
      }), access.farmerOfService('id', { tokenInQuery: true })),

      route('patch', '/services/:id/analyze', hiring.analyzeOffer, hiringOperation({
        tag: TAGS.farmerServices,
        summary: 'Aceitar ou recusar candidatura (RF03)',
        description:
          '**Accept**: exige uma proposta `Accepted` na conversa da candidatura (a concordância dos dois). A candidatura é aceita, o serviço vai ' +
          'para `In Progress` com o trabalhador e o combinado (`agreement`), e as demais pendentes são recusadas (`auto_rejected`); as conversas ' +
          'delas são encerradas.\n\n' +
          '**Reject**: só a candidatura é recusada, e a conversa dela é encerrada.',
        params: [serviceId],
        body: 'AnalyzeInput',
        success: { status: 200, description: 'Candidatura analisada. No Accept, traz também o serviço.', schema: 'AnalyzeResponse' },
        errors: {
          400: '`action` diferente de Accept/Reject; `application_id` faltando; candidatura de outro serviço.',
          404: 'Serviço ou candidatura não encontrados.',
          409: 'O serviço não está mais `Pending`; a candidatura já foi analisada; Accept sem proposta aceita na conversa.'
        }
      }), access.farmerOfService()),

      route('post', '/services/:id/payment', hiring.processPayment, hiringOperation({
        tag: TAGS.farmerServices,
        summary: 'Liberar pagamento (RF04)',
        description:
          'Simulação: registra o pagamento do total informado (`value`, em R$) e conclui o serviço (`Completed`, com `payment_id` e ' +
          '`completed_at`). Nenhum dinheiro é movimentado. O total é informado pelo produtor porque o combinado pode ser por hora, dia, ' +
          'metro, hectare ou empreitada. A conversa fica aberta por mais 7 dias, a avaliação dupla é liberada e o trabalhador recebe push com o valor.',
        params: [serviceId],
        body: 'PaymentInput',
        success: { status: 200, description: 'Pagamento registrado e serviço concluído.', schema: 'PaymentResponse' },
        errors: { 400: '`value` faltando, zero ou negativo.', 404: 'Serviço não encontrado.', 409: 'O serviço não está `In Progress`.' }
      }), access.farmerOfService())
    ],
    worker: [
      route('post', '/services/:id/apply', hiring.applyForService, hiringOperation({
        tag: TAGS.jobs,
        summary: 'Candidatar-se (RF02)',
        params: [jobId],
        body: 'ApplyInput',
        success: { status: 201, description: 'Candidatura `Pending` criada.', schema: 'ApplicationResponse' },
        errors: {
          400: '`worker_id` faltando; `message` com mais de 300 caracteres ou com palavras não permitidas.',
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
