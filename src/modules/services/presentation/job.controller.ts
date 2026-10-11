import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { OpenService } from '../service.contract';
import type { ServiceUseCases } from '../services.module';
import { parseJobFilters, parseWorkerIdQuery } from './service.parsers';

// HTTP das vagas do lado do trabalhador: buscar e ver. Candidatura e desistência ficam no HiringController.
export interface JobController {
  searchServices: Handler<OpenService[]>;
  getServiceDetail: Handler<OpenService, IdParams>;
}

export function createJobController(services: ServiceUseCases): JobController {
  // RF02 - GET /api/workers/services?q=&category=&min_hours=&max_hours=&from=&to=&sort= - Vagas abertas
  const searchServices: Handler<OpenService[]> = async (req, res) => {
    const filters = parseJobFilters(req.query);
    if (!filters.ok) { sendFailure(res, filters); return; }
    res.status(200).json(await services.searchOpenServices.execute(filters.value));
  };

  // GET /api/workers/services/:id?worker_id= - Detalhe da vaga com cidade/UF da fazenda
  // (e o ponto no mapa, se `worker_id` for o trabalhador aceito no serviço)
  const getServiceDetail: Handler<OpenService, IdParams> = async (req, res) => {
    const viewer = parseWorkerIdQuery(req.query);
    if (!viewer.ok) { sendFailure(res, viewer); return; }

    const result = await services.getOpenService.execute({ serviceId: toId(req.params.id), viewerWorkerId: viewer.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  return { searchServices, getServiceDetail };
}
