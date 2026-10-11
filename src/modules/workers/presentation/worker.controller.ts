import { accountToken } from '#modules/accounts';
import type { ApplicationWithService } from '#modules/hiring';
import type { OpenService } from '#modules/services';
import type { MessageResponse } from '#shared/contracts/api';
import type { SessionTokens } from '#shared/domain/tokens';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import { APPLICATIONS_CHANGED_EVENT, openEventStream, sendEvent } from '#shared/infra/http/sse';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { Worker, WorkerResponse, WorkerSignupResponse } from '../worker.contract';
import type { WorkerUseCases } from '../workers.module';
import { parseWorkerInput, parseWorkerUpdate } from './worker.parsers';

// HTTP do cadastro e acompanhamento do trabalhador (com os avisos em tempo real das candidaturas).
export interface WorkerController {
  listWorkers: Handler<Worker[]>;
  createWorker: Handler<WorkerSignupResponse>;
  getWorker: Handler<Worker, IdParams>;
  updateWorker: Handler<WorkerResponse, IdParams>;
  deleteWorker: Handler<MessageResponse, IdParams>;
  listWorkerApplications: Handler<ApplicationWithService[], IdParams>;
  listWorkerServices: Handler<OpenService[], IdParams>;
  workerApplicationEvents: Handler<never, IdParams>;
}

export function createWorkerController(workers: WorkerUseCases, tokens: SessionTokens): WorkerController {
  // GET /api/workers - Lista os trabalhadores (CPF mascarado)
  const listWorkers: Handler<Worker[]> = async (_req, res) => {
    res.status(200).json(await workers.listWorkers.execute());
  };

  // POST /api/workers - Cadastra um novo trabalhador
  const createWorker: Handler<WorkerSignupResponse> = async (req, res) => {
    const input = parseWorkerInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await workers.registerWorker.execute(input.value);
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Worker created successfully!', worker: result.value.worker, user: result.value.user, token: accountToken(tokens, result.value.user) });
  };

  // GET /api/workers/:id - Perfil completo do próprio trabalhador
  const getWorker: Handler<Worker, IdParams> = async (req, res) => {
    const result = await workers.getWorker.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/workers/:id - Edita o trabalhador (id e cpf não podem ser alterados)
  const updateWorker: Handler<WorkerResponse, IdParams> = async (req, res) => {
    const changes = parseWorkerUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }

    const result = await workers.updateWorker.execute({ workerId: toId(req.params.id), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker updated successfully!', worker: result.value });
  };

  // DELETE /api/workers/:id - Remove o trabalhador (com as candidaturas dele)
  const deleteWorker: Handler<MessageResponse, IdParams> = async (req, res) => {
    const result = await workers.deleteWorker.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Worker deleted successfully!' });
  };

  // GET /api/workers/:id/applications - Candidaturas com o serviço embutido
  const listWorkerApplications: Handler<ApplicationWithService[], IdParams> = async (req, res) => {
    const result = await workers.listWorkerApplications.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // GET /api/workers/:id/services - Serviços atribuídos ao trabalhador
  const listWorkerServices: Handler<OpenService[], IdParams> = async (req, res) => {
    const result = await workers.listWorkerServices.execute({ workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // GET /api/workers/:id/events - Avisa quando o status de uma candidatura do trabalhador muda
  const workerApplicationEvents: Handler<never, IdParams> = async (req, res) => {
    const listener = (): void => sendEvent(res, APPLICATIONS_CHANGED_EVENT);
    const result = await workers.watchWorkerApplications.execute({ workerId: toId(req.params.id), listener });
    if (!result.ok) { sendFailure(res, result); return; }
    openEventStream(res, result.value);
  };

  return { listWorkers, createWorker, getWorker, updateWorker, deleteWorker, listWorkerApplications, listWorkerServices, workerApplicationEvents };
}
