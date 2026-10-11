import { invalid } from '#shared/domain/result';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { FarmerServiceItem, ServiceResponse, ServiceStatus, ServiceWithFarm } from '../service.contract';
import { isServiceStatus, serviceStatusList } from '../domain/service-status';
import type { ServiceUseCases } from '../services.module';
import { parseServiceInput, parseServiceUpdate } from './service.parsers';

// HTTP dos serviços do lado do produtor: publicar, ver, editar, cancelar e listar os seus.
// Candidaturas, aceite e pagamento ficam no HiringController.
export interface ServiceController {
  requestService: Handler<ServiceResponse>;
  getService: Handler<ServiceWithFarm, IdParams>;
  updateService: Handler<ServiceResponse, IdParams>;
  cancelService: Handler<ServiceResponse, IdParams>;
  listFarmerServices: Handler<FarmerServiceItem[], IdParams>;
}

export function createServiceController(services: ServiceUseCases): ServiceController {
  // RF01 - POST /api/farmers/services - Cadastra demanda com atividade, local e valor
  const requestService: Handler<ServiceResponse> = async (req, res) => {
    const input = parseServiceInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await services.publishService.execute(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Service requested successfully!', service: result.value });
  };

  // GET /api/farmers/services/:id - Serviço com a fazenda
  const getService: Handler<ServiceWithFarm, IdParams> = async (req, res) => {
    const result = await services.getService.execute({ serviceId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/farmers/services/:id - Edita um serviço ainda sem trabalhador (status Pending)
  const updateService: Handler<ServiceResponse, IdParams> = async (req, res) => {
    const changes = parseServiceUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await services.updateService.execute({ serviceId: toId(req.params.id), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Service updated successfully!', service: result.value });
  };

  // PATCH /api/farmers/services/:id/cancel - Cancela um serviço Pending (recusa as candidaturas pendentes)
  const cancelService: Handler<ServiceResponse, IdParams> = async (req, res) => {
    const result = await services.cancelService.execute({ serviceId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Service cancelled successfully!', service: result.value });
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

    const result = await services.listFarmerServices.execute({ farmerId: toId(req.params.id), status });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  return { requestService, getService, updateService, cancelService, listFarmerServices };
}
