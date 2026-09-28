import type {
  AnalyzeResponse,
  ApplicationWithWorker,
  FarmerServiceItem,
  PaymentResponse,
  ServiceResponse,
  ServiceStatus,
  ServiceWithFarm
} from '../contracts';
import { isServiceStatus, serviceStatusList } from '../constants/status';
import { invalid } from '../domain/result';
import { toBody } from '../http/body';
import { parseAnalyzeInput, parseServiceInput, parseServiceUpdate } from '../http/parsers';
import { sendFailure, toId } from '../http/respond';
import type { Handler, IdParams } from '../http/types';
import type { HiringUseCases } from '../usecases/HiringUseCases';
import type { ServiceUseCases } from '../usecases/ServiceUseCases';

// HTTP dos serviços do lado do produtor: publicar, editar, cancelar, analisar candidaturas e pagar.
export interface ServiceController {
  requestService: Handler<ServiceResponse>;
  getService: Handler<ServiceWithFarm, IdParams>;
  updateService: Handler<ServiceResponse, IdParams>;
  cancelService: Handler<ServiceResponse, IdParams>;
  listServiceApplications: Handler<ApplicationWithWorker[], IdParams>;
  listFarmerServices: Handler<FarmerServiceItem[], IdParams>;
  analyzeOffer: Handler<AnalyzeResponse, IdParams>;
  processPayment: Handler<PaymentResponse, IdParams>;
}

export function createServiceController(services: ServiceUseCases, hiring: HiringUseCases): ServiceController {
  // RF01 - POST /api/farmers/services - Cadastra demanda com atividade, local e valor
  const requestService: Handler<ServiceResponse> = async (req, res) => {
    const input = parseServiceInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await services.request(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Service requested successfully!', service: result.value });
  };

  // GET /api/farmers/services/:id - Serviço com a fazenda
  const getService: Handler<ServiceWithFarm, IdParams> = async (req, res) => {
    const result = await services.get(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/farmers/services/:id - Edita um serviço ainda sem trabalhador (status Pending)
  const updateService: Handler<ServiceResponse, IdParams> = async (req, res) => {
    const changes = parseServiceUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await services.update(toId(req.params.id), changes.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Service updated successfully!', service: result.value });
  };

  // PATCH /api/farmers/services/:id/cancel - Cancela um serviço Pending (recusa as candidaturas pendentes)
  const cancelService: Handler<ServiceResponse, IdParams> = async (req, res) => {
    const result = await services.cancel(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Service cancelled successfully!', service: result.value });
  };

  // GET /api/farmers/services/:id/applications - Candidaturas com o trabalhador embutido (CPF mascarado)
  const listServiceApplications: Handler<ApplicationWithWorker[], IdParams> = async (req, res) => {
    const result = await services.listApplications(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // GET /api/farmers/:id/services?status= - Serviços do produtor
  const listFarmerServices: Handler<FarmerServiceItem[], IdParams> = async (req, res) => {
    const rawStatus = req.query['status'];
    let status: ServiceStatus | undefined;
    if (rawStatus !== undefined) {
      if (!isServiceStatus(rawStatus)) {
        sendFailure(res, invalid(`Status inválido. Use um destes: ${serviceStatusList()}.`));
        return;
      }
      status = rawStatus;
    }

    const result = await services.listForFarmer(toId(req.params.id), status);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // RF03 - PATCH /api/farmers/services/:id/analyze - Aceita ou recusa uma candidatura
  const analyzeOffer: Handler<AnalyzeResponse, IdParams> = async (req, res) => {
    const input = parseAnalyzeInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await hiring.analyze(toId(req.params.id), input.value);
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
    const result = await hiring.pay(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Payment released and service completed successfully!', ...result.value });
  };

  return {
    requestService,
    getService,
    updateService,
    cancelService,
    listServiceApplications,
    listFarmerServices,
    analyzeOffer,
    processPayment
  };
}
