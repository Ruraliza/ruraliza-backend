import type { AccessPolicies } from '#modules/auth';
import type { ServiceSchemaName } from '#modules/services';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { HiringController } from './hiring.controller';
import type { HiringSchemaName } from './hiring.schemas';

const serviceId = pathParam('id', 'ID do serviço.');
const chatId = pathParam('id', 'ID da conversa.');
const jobId = pathParam('id', 'ID do serviço (vaga).');
const workerId = pathParam('id', 'ID do trabalhador.');
const inviteId = pathParam('id', 'ID do convite.');
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
      }), access.farmerOfService()),

      route('post', '/services/:id/invites', hiring.inviteWorker, hiringOperation({
        tag: TAGS.farmerServices,
        summary: 'Convidar do catálogo',
        description:
          'Convida um trabalhador do catálogo da vaga (`GET /api/farmers/services/{id}/catalog`). A API confere de novo, na hora, que ele ' +
          'está no catálogo. Um convite por vaga e trabalhador; no máximo 20 por vaga (contam todos os estados). O trabalhador recebe push ' +
          'que abre os convites dele.',
        params: [serviceId],
        body: 'InviteInput',
        success: { status: 201, description: 'Convite `Pending` criado.', schema: 'InviteResponse' },
        errors: {
          400: '`worker_id` faltando ou inválido.',
          404: 'Serviço ou trabalhador não encontrados.',
          409: 'A vaga não está `Pending` ou passou do prazo; a pessoa já foi convidada (ou recusou) para esta vaga; o limite de convites ' +
            'da vaga foi atingido; a pessoa não está no catálogo da vaga (desligou o catálogo, mudou de categoria, está fora do raio, já se candidatou).'
        }
      }), access.farmerOfService())
    ],
    worker: [
      route('get', '/:id/invites', hiring.listWorkerInvites, hiringOperation({
        tag: TAGS.jobs,
        summary: 'Convites recebidos',
        description: 'Os pendentes primeiro, depois os mais recentes, com a vaga. Os pendentes de vagas fechadas ou vencidas aparecem como `Expired`.',
        params: [workerId],
        success: { status: 200, description: 'Convites com a vaga.', schema: { listOf: 'InviteWithService' } },
        errors: { 404: 'Trabalhador não encontrado.' }
      }), access.ownWorker()),

      route('patch', '/invites/:id', hiring.answerInvite, hiringOperation({
        tag: TAGS.jobs,
        summary: 'Aceitar ou recusar convite',
        description:
          'Só o convidado responde, e uma vez.\n\n' +
          '**Accept**: com as mesmas regras da candidatura, cria a candidatura (`Pending`, `invited: true`) e o convite vira `Accepted`, juntos. ' +
          'A conversa com o produtor abre sozinha (`chat_id`) e o produtor recebe push.\n\n' +
          '**Decline**: o convite vira `Declined`, o produtor é avisado e a pessoa não pode ser convidada de novo para a vaga.',
        params: [inviteId],
        body: 'InviteAnswerInput',
        success: { status: 200, description: 'Convite respondido. No Accept, traz a candidatura e a conversa.', schema: 'InviteAnswerResponse' },
        errors: {
          400: "`action` diferente de 'Accept'/'Decline'.",
          403: 'O convite é de outra pessoa.',
          404: 'Convite ou serviço não encontrados.',
          409: 'O convite expirou ou já foi respondido; Accept com a vaga fechada ou vencida, com candidatura recusada ou já existente.'
        }
      }), access.worker()),

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
