import type { ServiceResponse } from '#modules/services';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import { APPLICATIONS_CHANGED_EVENT, openEventStream, sendEvent } from '#shared/infra/http/sse';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { AnalyzeResponse, ApplicationResponse, ApplicationWithWorker, PaymentResponse } from '../hiring.contract';
import type { HiringUseCases } from '../hiring.module';
import { parseAnalyzeInput, parseWorkerAction } from './hiring.parsers';

// HTTP da contratação: candidaturas do serviço (com os avisos em tempo real), aceite/recusa e
// pagamento (produtor); candidatura e desistência (trabalhador).
export interface HiringController {
  listServiceApplications: Handler<ApplicationWithWorker[], IdParams>;
  serviceApplicationEvents: Handler<never, IdParams>;
  analyzeOffer: Handler<AnalyzeResponse, IdParams>;
  processPayment: Handler<PaymentResponse, IdParams>;
  applyForService: Handler<ApplicationResponse, IdParams>;
  withdrawFromService: Handler<ServiceResponse, IdParams>;
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

  // RF04 - POST /api/farmers/services/:id/payment - Libera o pagamento (simulação)
  const processPayment: Handler<PaymentResponse, IdParams> = async (req, res) => {
    const result = await hiring.payService.execute({ serviceId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Payment released and service completed successfully!', ...result.value });
  };

  // RF02 - POST /api/workers/services/:id/apply - Candidata-se a um serviço
  const applyForService: Handler<ApplicationResponse, IdParams> = async (req, res) => {
    const input = parseWorkerAction(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await hiring.applyForService.execute({ serviceId: toId(req.params.id), workerId: input.value.worker_id });
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

  return { listServiceApplications, serviceApplicationEvents, analyzeOffer, processPayment, applyForService, withdrawFromService };
}
