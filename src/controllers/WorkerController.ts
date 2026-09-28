import type {
  ApplicationResponse,
  ApplicationWithService,
  MessageResponse,
  OpenService,
  Service,
  ServiceApplication,
  ServiceResponse,
  Worker,
  WorkerActionInput,
  WorkerResponse
} from '../contracts';
import { APPLICATION_STATUS, SERVICE_STATUS } from '../constants/status';
import { nextId } from '../data/ids';
import { type Body, type Result, invalid, text, toBody, valid } from '../http/body';
import type { Handler, IdParams } from '../http/types';
import { farms } from '../models/Farm';
import { services } from '../models/Service';
import { applications } from '../models/ServiceApplication';
import { workers } from '../models/Worker';
import { findById, removeWhere, requireFound } from '../utils/collections';
import { parseProfileInput, parseProfileUpdate, toPublicProfile } from '../utils/profile';

// --- VALIDAÇÃO DOS CORPOS ---

// Texto opcional do perfil (certificados, experiência): vazio vira null no cadastro.
function optionalText(value: unknown): string | null {
  return value ? text(value) : null;
}

// Na edição, null limpa o campo; qualquer outro valor é guardado como texto.
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function parseWorkerAction(body: Body): Result<WorkerActionInput> {
  const workerId = body['worker_id'];
  if (!workerId) {
    return invalid(400, 'Informe o worker_id.');
  }
  return valid({ worker_id: Number(workerId) });
}

// --- TRABALHADORES ---

// GET /api/workers - Lista os trabalhadores (CPF mascarado)
export const listWorkers: Handler<Worker[]> = (_req, res) => {
  return res.status(200).json(workers.map(toPublicProfile));
};

// POST /api/workers - Cadastra um novo trabalhador
export const createWorker: Handler<WorkerResponse> = (req, res) => {
  const body = toBody(req.body);
  const parsed = parseProfileInput(body, workers);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const newWorker: Worker = {
    id: nextId('worker'),
    ...parsed.value,
    certificates: optionalText(body['certificates']),
    experience: optionalText(body['experience']),
    insertion_date: new Date().toISOString()
  };

  workers.push(newWorker);

  return res.status(201).json({ message: 'Worker created successfully!', worker: newWorker });
};

// PATCH /api/workers/:id - Edita o trabalhador (id e cpf não podem ser alterados)
export const updateWorker: Handler<WorkerResponse, IdParams> = (req, res) => {
  const worker = findById(workers, req.params.id);
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }

  const body = toBody(req.body);
  const parsed = parseProfileUpdate(body, workers, worker.id);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const { email, name, phone } = parsed.value;
  const { certificates, experience } = body;
  if (email !== undefined) worker.email = email;
  if (name !== undefined) worker.name = name;
  if (certificates !== undefined) worker.certificates = nullableText(certificates);
  if (experience !== undefined) worker.experience = nullableText(experience);
  if (phone !== undefined) worker.phone = phone;

  return res.status(200).json({ message: 'Worker updated successfully!', worker });
};

// DELETE /api/workers/:id - Remove o trabalhador
export const deleteWorker: Handler<MessageResponse, IdParams> = (req, res) => {
  const worker = findById(workers, req.params.id);
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }

  if (services.some((s) => s.worker_id === worker.id && s.status === SERVICE_STATUS.IN_PROGRESS)) {
    return res.status(409).json({ error: 'Não é possível remover: há serviço em andamento atribuído a este trabalhador.' });
  }

  // As candidaturas embutem o perfil do trabalhador, então saem junto com ele.
  removeWhere(applications, (a) => a.worker_id === worker.id);
  removeWhere(workers, (w) => w.id === worker.id);

  return res.status(200).json({ message: 'Worker deleted successfully!' });
};

// --- VAGAS ---

// RF02 - Busca serviços disponíveis
export const searchServices: Handler<OpenService[]> = (req, res) => {
  const category = req.query['category'];

  let pendingServices = services.filter((s) => s.status === SERVICE_STATUS.PENDING);
  if (category) {
    pendingServices = pendingServices.filter((s) => s.category === category);
  }

  return res.status(200).json(pendingServices.map(withFarmLocation));
};

// PATCH /api/workers/services/:id/withdraw - O trabalhador desiste, e tudo volta uma etapa:
// - candidatura Pending: é removida (pode se candidatar de novo depois);
// - já aceito (serviço In Progress): o serviço volta a Pending sem trabalhador e as
//   candidaturas recusadas pelo aceite voltam a Pending para o produtor escolher outro.
// Body: { worker_id }
export const withdrawFromService: Handler<ServiceResponse, IdParams> = (req, res) => {
  const parsed = parseWorkerAction(toBody(req.body));
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }
  const { worker_id } = parsed.value;

  const service = findById(services, req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }

  const application = applications.find((a) => a.service_id === service.id && a.worker_id === worker_id);
  if (!application) {
    return res.status(404).json({ error: 'Você não tem candidatura neste serviço.' });
  }

  if (application.status === APPLICATION_STATUS.PENDING && service.status === SERVICE_STATUS.PENDING) {
    removeWhere(applications, (a) => a.id === application.id);
    return res.status(200).json({ message: 'Application withdrawn.', service });
  }

  if (application.status === APPLICATION_STATUS.ACCEPTED && service.status === SERVICE_STATUS.IN_PROGRESS) {
    // TODO(db): executar numa transação (serviço + candidaturas).
    removeWhere(applications, (a) => a.id === application.id);
    applications
      .filter((a) => a.service_id === service.id && a.auto_rejected === true)
      .forEach((a) => {
        a.status = APPLICATION_STATUS.PENDING;
        delete a.auto_rejected;
      });
    service.worker_id = null;
    service.status = SERVICE_STATUS.PENDING;
    return res.status(200).json({ message: 'You left the service. It is open for applications again.', service });
  }

  return res.status(409).json({ error: 'Não é possível desistir: a candidatura já foi recusada ou o serviço já foi encerrado.' });
};

// RF02 - Candidata-se a um serviço
// Body: { worker_id }
export const applyForService: Handler<ApplicationResponse, IdParams> = (req, res) => {
  const parsed = parseWorkerAction(toBody(req.body));
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const service = findById(services, req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }

  const worker = findById(workers, parsed.value.worker_id);
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }

  if (service.status !== SERVICE_STATUS.PENDING) {
    return res.status(409).json({ error: 'Este serviço não está mais aberto para candidaturas.' });
  }

  // TODO(db): trocar por restrição UNIQUE (service_id, worker_id) no banco.
  const alreadyApplied = applications.some((a) => a.service_id === service.id && a.worker_id === worker.id);
  if (alreadyApplied) {
    return res.status(409).json({ error: 'Você já se candidatou a este serviço.' });
  }

  const newApplication: ServiceApplication = {
    id: nextId('application'),
    service_id: service.id,
    worker_id: worker.id,
    status: APPLICATION_STATUS.PENDING,
    insertion_date: new Date().toISOString()
  };

  applications.push(newApplication);

  return res.status(201).json({
    message: "Application sent successfully! Wait for the farmer's approval.",
    application: newApplication
  });
};

// --- LEITURAS ---

// Cidade/UF da fazenda do serviço (o endereço completo não é exposto ao trabalhador).
function withFarmLocation(service: Service): OpenService {
  const farm = requireFound(findById(farms, service.farm_id), `fazenda do serviço ${service.id}`);
  return { ...service, farm: { city: farm.city, state: farm.state } };
}

// GET /api/workers/:id - Perfil completo do próprio trabalhador
export const getWorker: Handler<Worker, IdParams> = (req, res) => {
  const worker = findById(workers, req.params.id);
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }
  return res.status(200).json(worker);
};

// GET /api/workers/:id/applications - Candidaturas com o serviço embutido
export const listWorkerApplications: Handler<ApplicationWithService[], IdParams> = (req, res) => {
  const worker = findById(workers, req.params.id);
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }

  const result = applications
    .filter((a) => a.worker_id === worker.id)
    .map((a): ApplicationWithService => ({
      ...a,
      service: withFarmLocation(requireFound(findById(services, a.service_id), `serviço da candidatura ${a.id}`))
    }));

  return res.status(200).json(result);
};

// GET /api/workers/:id/services - Serviços atribuídos ao trabalhador
export const listWorkerServices: Handler<OpenService[], IdParams> = (req, res) => {
  const worker = findById(workers, req.params.id);
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }
  return res.status(200).json(services.filter((s) => s.worker_id === worker.id).map(withFarmLocation));
};

// GET /api/workers/services/:id - Detalhe da vaga com cidade/UF da fazenda
export const getServiceDetail: Handler<OpenService, IdParams> = (req, res) => {
  const service = findById(services, req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }
  return res.status(200).json(withFarmLocation(service));
};
