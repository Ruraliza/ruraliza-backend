import type { ServiceResponse } from '#modules/services';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import { APPLICATIONS_CHANGED_EVENT, openEventStream, sendEvent } from '#shared/infra/http/sse';
import type { Handler, IdParams, ProposalParams } from '#shared/infra/http/types';
import type { AnalyzeResponse, ApplicationResponse, ApplicationWithWorker, InviteAnswerResponse, InviteResponse, InviteWithService, PaymentResponse, ProposalResponse } from '../hiring.contract';
import type { HiringUseCases } from '../hiring.module';
import { parseAnalyzeInput, parseApplyInput, parseInviteAnswer, parseInviteInput, parsePaymentInput, parseProposalAnswer, parseProposalInput, parseWorkerAction, viewerOf } from './hiring.parsers';

// HTTP da contratação: candidaturas do serviço (com os avisos em tempo real), aceite/recusa e pagamento
// (produtor); candidatura e desistência (trabalhador); propostas (conversa).
export interface HiringController {
  listServiceApplications: Handler<ApplicationWithWorker[], IdParams>;
  serviceApplicationEvents: Handler<never, IdParams>;
  analyzeOffer: Handler<AnalyzeResponse, IdParams>;
  processPayment: Handler<PaymentResponse, IdParams>;
  applyForService: Handler<ApplicationResponse, IdParams>;
  withdrawFromService: Handler<ServiceResponse, IdParams>;
  propose: Handler<ProposalResponse, IdParams>;
  answerProposal: Handler<ProposalResponse, ProposalParams>;
  inviteWorker: Handler<InviteResponse, IdParams>;
  listWorkerInvites: Handler<InviteWithService[], IdParams>;
  answerInvite: Handler<InviteAnswerResponse, IdParams>;
}

export function createHiringController(hiring: HiringUseCases): HiringController {
  // GET /api/farmers/services/:id/applications - Candidaturas com o trabalhador (contato mascarado) e a reputação
  const listServiceApplications: Handler<ApplicationWithWorker[], IdParams> = async (req, res) => {
    const result = await hiring.listServiceApplications.execute({ serviceId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // GET /api/farmers/services/:id/events - Avisa quando alguém se candidata, desiste ou é aceito/recusado
  const serviceApplicationEvents: Handler<never, IdParams> = async (req, res) => {
    const listener = (): void => sendEvent(res, APPLICATIONS_CHANGED_EVENT);
    const result = await hiring.watchServiceApplications.execute({ serviceId: toId(req.params.id), listener });
    if (!result.ok) { sendFailure(res, result); return; }
    openEventStream(res, result.value);
  };

  // RF03 - PATCH /api/farmers/services/:id/analyze - Aceita ou recusa uma candidatura
  const analyzeOffer: Handler<AnalyzeResponse, IdParams> = async (req, res) => {
    const input = parseAnalyzeInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await hiring.analyzeApplication.execute({ serviceId: toId(req.params.id), ...input.value });
    if (!result.ok) { sendFailure(res, result); return; }

    const { application, service } = result.value;
    if (service === undefined) {
      res.status(200).json({ message: 'Application rejected.', application });
      return;
    }
    res.status(200).json({ message: 'Worker accepted successfully. Service is now in progress!', service, application });
  };

  // RF04 - POST /api/farmers/services/:id/payment - Libera o pagamento (simulação) do total informado e conclui o serviço
  const processPayment: Handler<PaymentResponse, IdParams> = async (req, res) => {
    const input = parsePaymentInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await hiring.payService.execute({ serviceId: toId(req.params.id), value: input.value.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Payment released and service completed successfully!', ...result.value });
  };

  // RF02 - POST /api/workers/services/:id/apply - Candidata-se a um serviço
  const applyForService: Handler<ApplicationResponse, IdParams> = async (req, res) => {
    const input = parseApplyInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const { worker_id, message } = input.value;
    const result = await hiring.applyForService.execute({ serviceId: toId(req.params.id), workerId: worker_id, ...(message ? { message } : {}) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({
      message: "Application sent successfully! Wait for the farmer's approval.",
      application: result.value
    });
  };

  // PATCH /api/workers/services/:id/withdraw - Desiste da candidatura ou do serviço aceito
  const withdrawFromService: Handler<ServiceResponse, IdParams> = async (req, res) => {
    const input = parseWorkerAction(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await hiring.withdrawFromService.execute({ serviceId: toId(req.params.id), workerId: input.value.worker_id });
    if (!result.ok) { sendFailure(res, result); return; }

    const { undone, service } = result.value;
    const message = undone === 'application'
      ? 'Application withdrawn.'
      : 'You left the service. It is open for applications again.';
    res.status(200).json({ message, service });
  };

  // POST /api/chats/:id/proposals - Proposta de valor e pagamento na conversa
  const propose: Handler<ProposalResponse, IdParams> = async (req, res) => {
    const input = parseProposalInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await hiring.propose.execute({ chatId: toId(req.params.id), viewer: viewerOf(res.locals.principal), terms: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Proposal sent.', proposal: result.value });
  };

  // PATCH /api/chats/:id/proposals/:proposalId - Aceita ou recusa a proposta do outro lado
  const answerProposal: Handler<ProposalResponse, ProposalParams> = async (req, res) => {
    const input = parseProposalAnswer(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await hiring.answerProposal.execute({
      chatId: toId(req.params.id), proposalId: toId(req.params.proposalId), viewer: viewerOf(res.locals.principal), action: input.value.action
    });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: input.value.action === 'Accept' ? 'Proposal accepted.' : 'Proposal declined.', proposal: result.value });
  };

  // POST /api/farmers/services/:id/invites - Convida um trabalhador do catálogo da vaga
  const inviteWorker: Handler<InviteResponse, IdParams> = async (req, res) => {
    const input = parseInviteInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await hiring.inviteWorker.execute({ serviceId: toId(req.params.id), workerId: input.value.worker_id });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Invite sent.', invite: result.value });
  };

  // GET /api/workers/:id/invites - Convites do trabalhador, os pendentes primeiro
  const listWorkerInvites: Handler<InviteWithService[], IdParams> = async (req, res) => {
    const result = await hiring.listWorkerInvites.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/workers/invites/:id - Aceita (vira candidato, com a conversa aberta) ou recusa o convite
  const answerInvite: Handler<InviteAnswerResponse, IdParams> = async (req, res) => {
    const input = parseInviteAnswer(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await hiring.answerInvite.execute({
      inviteId: toId(req.params.id), workerId: viewerOf(res.locals.principal).workerId, action: input.value.action
    });
    if (!result.ok) { sendFailure(res, result); return; }
    const { invite, application, chatId } = result.value;
    if (application === undefined) { res.status(200).json({ message: 'Invite declined.', invite }); return; }
    res.status(200).json({ message: 'Invite accepted.', invite, application, ...(chatId === undefined ? {} : { chat_id: chatId }) });
  };

  return { inviteWorker, listWorkerInvites, answerInvite, propose, answerProposal, listServiceApplications, serviceApplicationEvents, analyzeOffer, processPayment, applyForService, withdrawFromService };
}
