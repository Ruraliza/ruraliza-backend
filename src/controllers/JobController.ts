import type { ApplicationResponse, OpenService, ServiceResponse } from '../contracts';
import { toBody } from '../http/body';
import { parseWorkerAction } from '../http/parsers';
import { sendFailure, toId } from '../http/respond';
import type { Handler, IdParams } from '../http/types';
import type { HiringUseCases } from '../usecases/HiringUseCases';
import type { ServiceUseCases } from '../usecases/ServiceUseCases';

// HTTP das vagas do lado do trabalhador: buscar, ver, candidatar-se e desistir.
export interface JobController {
  searchServices: Handler<OpenService[]>;
  getServiceDetail: Handler<OpenService, IdParams>;
  applyForService: Handler<ApplicationResponse, IdParams>;
  withdrawFromService: Handler<ServiceResponse, IdParams>;
}

export function createJobController(services: ServiceUseCases, hiring: HiringUseCases): JobController {
  // RF02 - GET /api/workers/services?category= - Vagas abertas
  const searchServices: Handler<OpenService[]> = async (req, res) => {
    const category = req.query['category'];
    if (category === undefined || category === '') {
      res.status(200).json(await services.searchOpen());
    } else if (typeof category === 'string') {
      res.status(200).json(await services.searchOpen(category));
    } else {
      // ?category repetido ou em formato de objeto não corresponde a nenhuma categoria.
      res.status(200).json([]);
    }
  };

  // GET /api/workers/services/:id - Detalhe da vaga com cidade/UF da fazenda
  const getServiceDetail: Handler<OpenService, IdParams> = async (req, res) => {
    const result = await services.getOpen(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // RF02 - POST /api/workers/services/:id/apply - Candidata-se a um serviço
  const applyForService: Handler<ApplicationResponse, IdParams> = async (req, res) => {
    const input = parseWorkerAction(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await hiring.apply(toId(req.params.id), input.value.worker_id);
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

    const result = await hiring.withdraw(toId(req.params.id), input.value.worker_id);
    if (!result.ok) { sendFailure(res, result); return; }

    const { undone, service } = result.value;
    const message = undone === 'application'
      ? 'Application withdrawn.'
      : 'You left the service. It is open for applications again.';
    res.status(200).json({ message, service });
  };

  return { searchServices, getServiceDetail, applyForService, withdrawFromService };
}
