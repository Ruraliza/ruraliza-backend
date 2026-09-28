import type { ApplicationWithService, MessageResponse, OpenService, Worker, WorkerResponse } from '../contracts';
import { toBody } from '../http/body';
import { parseWorkerInput, parseWorkerUpdate } from '../http/parsers';
import { sendFailure, toId } from '../http/respond';
import type { Handler, IdParams } from '../http/types';
import type { WorkerUseCases } from '../usecases/WorkerUseCases';

// HTTP do cadastro e acompanhamento do trabalhador.
export interface WorkerController {
  listWorkers: Handler<Worker[]>;
  createWorker: Handler<WorkerResponse>;
  getWorker: Handler<Worker, IdParams>;
  updateWorker: Handler<WorkerResponse, IdParams>;
  deleteWorker: Handler<MessageResponse, IdParams>;
  listWorkerApplications: Handler<ApplicationWithService[], IdParams>;
  listWorkerServices: Handler<OpenService[], IdParams>;
}

export function createWorkerController(workers: WorkerUseCases): WorkerController {
  // GET /api/workers - Lista os trabalhadores (CPF mascarado)
  const listWorkers: Handler<Worker[]> = async (_req, res) => {
    res.status(200).json(await workers.list());
  };

  // POST /api/workers - Cadastra um novo trabalhador
  const createWorker: Handler<WorkerResponse> = async (req, res) => {
    const input = parseWorkerInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await workers.create(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Worker created successfully!', worker: result.value });
  };

  // GET /api/workers/:id - Perfil completo do próprio trabalhador
  const getWorker: Handler<Worker, IdParams> = async (req, res) => {
    const result = await workers.get(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/workers/:id - Edita o trabalhador (id e cpf não podem ser alterados)
  const updateWorker: Handler<WorkerResponse, IdParams> = async (req, res) => {
    const changes = parseWorkerUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await workers.update(toId(req.params.id), changes.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker updated successfully!', worker: result.value });
  };

  // DELETE /api/workers/:id - Remove o trabalhador (com as candidaturas dele)
  const deleteWorker: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await workers.delete(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker deleted successfully!' });
  };

  // GET /api/workers/:id/applications - Candidaturas com o serviço embutido
  const listWorkerApplications: Handler<ApplicationWithService[], IdParams> = async (req, res) => {
    const result = await workers.listApplications(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // GET /api/workers/:id/services - Serviços atribuídos ao trabalhador
  const listWorkerServices: Handler<OpenService[], IdParams> = async (req, res) => {
    const result = await workers.listServices(toId(req.params.id));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  return { listWorkers, createWorker, getWorker, updateWorker, deleteWorker, listWorkerApplications, listWorkerServices };
}
