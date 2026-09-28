import type {
  AnalyzeAction,
  AnalyzeInput,
  AnalyzeResponse,
  ApplicationWithWorker,
  Farm,
  FarmInput,
  FarmResponse,
  FarmUpdate,
  Farmer,
  FarmerResponse,
  FarmerServiceItem,
  MessageResponse,
  Payment,
  PaymentResponse,
  Service,
  ServiceInput,
  ServiceResponse,
  ServiceStatus,
  ServiceUpdate,
  ServiceWithFarm
} from '../contracts';
import { APPLICATION_STATUS, PAYMENT_STATUS, SERVICE_STATUS, isServiceStatus, serviceStatusList } from '../constants/status';
import { nextId } from '../data/ids';
import { type Body, type Result, invalid, missingMessage, text, toBody, valid } from '../http/body';
import type { FarmParams, Handler, IdParams } from '../http/types';
import { farms } from '../models/Farm';
import { farmers } from '../models/Farmer';
import { payments } from '../models/Payment';
import { services } from '../models/Service';
import { applications } from '../models/ServiceApplication';
import { workers } from '../models/Worker';
import { findById, removeWhere, requireFound } from '../utils/collections';
import { parseProfileInput, parseProfileUpdate, toPublicProfile } from '../utils/profile';
import { isPositiveNumber, missingFields } from '../utils/validation';

// Erros inesperados sobem para o handler global (o Express 5 repassa exceções).

const ANALYZE_ACTIONS: readonly AnalyzeAction[] = ['Accept', 'Reject'];
const FARM_FIELDS = ['address', 'city', 'state'] as const satisfies readonly (keyof FarmInput)[];

// --- VALIDAÇÃO DOS CORPOS ---

function parseFarmInput(body: Body): Result<FarmInput> {
  const missing = missingFields(body, FARM_FIELDS);
  if (missing.length > 0) {
    return invalid(400, missingMessage(missing));
  }
  return valid({ address: text(body['address']), city: text(body['city']), state: text(body['state']) });
}

function parseFarmUpdate(body: Body): Result<FarmUpdate> {
  if (body['id'] !== undefined || body['farmer_id'] !== undefined) {
    return invalid(400, 'Só é possível alterar endereço, cidade e estado.');
  }

  const blank = FARM_FIELDS.filter((f) => body[f] !== undefined && !text(body[f]).trim());
  if (blank.length > 0) {
    return invalid(400, `Estes campos não podem ficar vazios: ${blank.join(', ')}.`);
  }

  const update: FarmUpdate = {};
  for (const field of FARM_FIELDS) {
    const value = body[field];
    if (value !== undefined) update[field] = text(value).trim();
  }
  return valid(update);
}

function parseServiceInput(body: Body): Result<ServiceInput> {
  const missing = missingFields(body, ['farmer_id', 'farm_id', 'name', 'category', 'duration', 'price']);
  if (missing.length > 0) {
    return invalid(400, missingMessage(missing));
  }

  const duration = body['duration'];
  const price = body['price'];
  if (!isPositiveNumber(duration)) {
    return invalid(400, 'A duração deve ser um número de horas maior que zero.');
  }
  if (!isPositiveNumber(price)) {
    return invalid(400, 'O valor deve ser um número maior que zero.');
  }

  return valid({
    farmer_id: Number(body['farmer_id']),
    farm_id: Number(body['farm_id']),
    name: text(body['name']).trim(),
    category: text(body['category']),
    duration,
    price
  });
}

function parseServiceUpdate(body: Body): Result<ServiceUpdate> {
  const locked = [body['farmer_id'], body['worker_id'], body['payment_id'], body['status']];
  if (locked.some((v) => v !== undefined)) {
    return invalid(400, 'Só é possível alterar fazenda, nome, categoria, duração e valor.');
  }

  const { farm_id, name, category, duration, price } = body;
  if (name !== undefined && !text(name).trim()) {
    return invalid(400, 'O nome do serviço não pode ficar vazio.');
  }
  if (category !== undefined && !text(category).trim()) {
    return invalid(400, 'A categoria não pode ficar vazia.');
  }
  if (duration !== undefined && !isPositiveNumber(duration)) {
    return invalid(400, 'A duração deve ser um número de horas maior que zero.');
  }
  if (price !== undefined && !isPositiveNumber(price)) {
    return invalid(400, 'O valor deve ser um número maior que zero.');
  }

  const update: ServiceUpdate = {};
  if (farm_id !== undefined) update.farm_id = Number(farm_id);
  if (name !== undefined) update.name = text(name).trim();
  if (category !== undefined) update.category = text(category);
  if (duration !== undefined) update.duration = duration;
  if (price !== undefined) update.price = price;
  return valid(update);
}

function isAnalyzeAction(value: unknown): value is AnalyzeAction {
  return ANALYZE_ACTIONS.some((action) => action === value);
}

function parseAnalyzeInput(body: Body): Result<AnalyzeInput> {
  const { application_id, action } = body;
  if (!isAnalyzeAction(action)) {
    return invalid(400, "A ação deve ser 'Accept' ou 'Reject'.");
  }
  if (!application_id) {
    return invalid(400, 'Informe o application_id.');
  }
  return valid({ application_id: Number(application_id), action });
}

// --- PRODUTORES ---

// GET /api/farmers - Lista os produtores (CPF mascarado)
export const listFarmers: Handler<Farmer[]> = (_req, res) => {
  return res.status(200).json(farmers.map(toPublicProfile));
};

// POST /api/farmers - Cadastra um novo produtor
export const createFarmer: Handler<FarmerResponse> = (req, res) => {
  const parsed = parseProfileInput(toBody(req.body), farmers);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const newFarmer: Farmer = {
    id: nextId('farmer'),
    ...parsed.value,
    farms: [],
    insertion_date: new Date().toISOString()
  };

  farmers.push(newFarmer);

  return res.status(201).json({ message: 'Farmer created successfully!', farmer: newFarmer });
};

// PATCH /api/farmers/:id - Edita o produtor (id e cpf não podem ser alterados)
export const updateFarmer: Handler<FarmerResponse, IdParams> = (req, res) => {
  const farmer = findById(farmers, req.params.id);
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  const parsed = parseProfileUpdate(toBody(req.body), farmers, farmer.id);
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const { email, name, phone } = parsed.value;
  if (email !== undefined) farmer.email = email;
  if (name !== undefined) farmer.name = name;
  if (phone !== undefined) farmer.phone = phone;

  return res.status(200).json({ message: 'Farmer updated successfully!', farmer });
};

// DELETE /api/farmers/:id - Remove o produtor
export const deleteFarmer: Handler<MessageResponse, IdParams> = (req, res) => {
  const farmer = findById(farmers, req.params.id);
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  const ownServices = services.filter((s) => s.farmer_id === farmer.id);
  if (ownServices.some((s) => s.status === SERVICE_STATUS.IN_PROGRESS)) {
    return res.status(409).json({ error: 'Não é possível remover: há serviço em andamento. Conclua o pagamento antes.' });
  }

  // Remove em cascata: candidaturas → serviços → fazendas → produtor (pagamentos ficam como histórico).
  const serviceIds = new Set(ownServices.map((s) => s.id));
  removeWhere(applications, (a) => serviceIds.has(a.service_id));
  removeWhere(services, (s) => serviceIds.has(s.id));
  removeWhere(farms, (f) => f.farmer_id === farmer.id);
  removeWhere(farmers, (f) => f.id === farmer.id);

  return res.status(200).json({ message: 'Farmer deleted successfully!' });
};

// --- FAZENDAS ---

// POST /api/farmers/:id/farms - Cadastra uma nova fazenda para um produtor
export const createFarm: Handler<FarmResponse, IdParams> = (req, res) => {
  const parsed = parseFarmInput(toBody(req.body));
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const farmer = findById(farmers, req.params.id);
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  const newFarm: Farm = {
    id: nextId('farm'),
    farmer_id: farmer.id,
    ...parsed.value,
    insertion_date: new Date().toISOString()
  };

  farms.push(newFarm);
  farmer.farms.push(newFarm.id);

  return res.status(201).json({ message: 'Farm registered successfully!', farm: newFarm });
};

// Fazenda removida pelo produtor continua guardada (deleted_at) para o histórico dos serviços,
// mas some das listas e não pode mais ser editada nem receber serviços.
const isActiveFarm = (farm: Farm): boolean => farm.deleted_at === undefined;

function findActiveFarm(id: unknown): Farm | undefined {
  const farm = findById(farms, id);
  return farm && isActiveFarm(farm) ? farm : undefined;
}

// Busca a fazenda ativa garantindo que é do produtor da rota.
function findOwnFarm(params: FarmParams): Result<{ farmer: Farmer; farm: Farm }> {
  const farmer = findById(farmers, params.id);
  if (!farmer) {
    return invalid(404, 'Produtor não encontrado.');
  }
  const farm = findActiveFarm(params.farmId);
  if (!farm || farm.farmer_id !== farmer.id) {
    return invalid(404, 'Fazenda não encontrada.');
  }
  return valid({ farmer, farm });
}

// PATCH /api/farmers/:id/farms/:farmId - Edita a fazenda (address, city, state)
export const updateFarm: Handler<FarmResponse, FarmParams> = (req, res) => {
  const found = findOwnFarm(req.params);
  if (!found.ok) {
    return res.status(found.status).json({ error: found.error });
  }

  const parsed = parseFarmUpdate(toBody(req.body));
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }

  const { farm } = found.value;
  const { address, city, state } = parsed.value;
  if (address !== undefined) farm.address = address;
  if (city !== undefined) farm.city = city;
  if (state !== undefined) farm.state = state;

  return res.status(200).json({ message: 'Farm updated successfully!', farm });
};

// DELETE /api/farmers/:id/farms/:farmId - Remove a fazenda (arquiva, guardando o histórico)
// Bloqueia com serviço ativo (Pending/In Progress); serviços encerrados continuam com a fazenda.
export const deleteFarm: Handler<MessageResponse, FarmParams> = (req, res) => {
  const found = findOwnFarm(req.params);
  if (!found.ok) {
    return res.status(found.status).json({ error: found.error });
  }

  const { farmer, farm } = found.value;
  const active: readonly ServiceStatus[] = [SERVICE_STATUS.PENDING, SERVICE_STATUS.IN_PROGRESS];
  if (services.some((s) => s.farm_id === farm.id && active.includes(s.status))) {
    return res.status(409).json({ error: 'Não é possível remover: a fazenda tem serviços abertos ou em andamento. Cancele ou conclua-os antes.' });
  }

  farm.deleted_at = new Date().toISOString();
  farmer.farms = farmer.farms.filter((id) => id !== farm.id);

  return res.status(200).json({ message: 'Farm deleted successfully!' });
};

// --- SERVIÇOS ---

// RF01 - Cadastra demanda com atividade, local e valor
export const requestService: Handler<ServiceResponse> = (req, res) => {
  const parsed = parseServiceInput(toBody(req.body));
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }
  const input = parsed.value;

  const farmer = findById(farmers, input.farmer_id);
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  const farm = findActiveFarm(input.farm_id);
  if (!farm) {
    return res.status(404).json({ error: 'Fazenda não encontrada.' });
  }
  if (farm.farmer_id !== farmer.id) {
    return res.status(400).json({ error: 'Esta fazenda não pertence a este produtor.' });
  }

  const newService: Service = {
    id: nextId('service'),
    farmer_id: farmer.id,
    farm_id: farm.id,
    worker_id: null,
    payment_id: null,
    name: input.name,
    category: input.category,
    duration: input.duration,
    price: input.price,
    status: SERVICE_STATUS.PENDING,
    insertion_date: new Date().toISOString()
  };

  services.push(newService);

  return res.status(201).json({ message: 'Service requested successfully!', service: newService });
};

// PATCH /api/farmers/services/:id - Edita um serviço ainda sem trabalhador (status Pending)
// Body: qualquer um de { farm_id, name, category, duration, price }
export const updateService: Handler<ServiceResponse, IdParams> = (req, res) => {
  const service = findById(services, req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }
  if (service.status !== SERVICE_STATUS.PENDING) {
    return res.status(409).json({ error: 'Só é possível editar serviços que ainda aguardam candidatos.' });
  }

  const parsed = parseServiceUpdate(toBody(req.body));
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }
  const update = parsed.value;

  if (update.farm_id !== undefined) {
    const farm = findActiveFarm(update.farm_id);
    if (!farm) {
      return res.status(404).json({ error: 'Fazenda não encontrada.' });
    }
    if (farm.farmer_id !== service.farmer_id) {
      return res.status(400).json({ error: 'Esta fazenda não pertence a este produtor.' });
    }
    service.farm_id = farm.id;
  }
  if (update.name !== undefined) service.name = update.name;
  if (update.category !== undefined) service.category = update.category;
  if (update.duration !== undefined) service.duration = update.duration;
  if (update.price !== undefined) service.price = update.price;

  return res.status(200).json({ message: 'Service updated successfully!', service });
};

// PATCH /api/farmers/services/:id/cancel - Cancela um serviço ainda sem trabalhador (status Pending)
// As candidaturas pendentes são recusadas.
export const cancelService: Handler<ServiceResponse, IdParams> = (req, res) => {
  const service = findById(services, req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }
  if (service.status !== SERVICE_STATUS.PENDING) {
    return res.status(409).json({ error: 'Só é possível cancelar serviços que ainda aguardam candidatos.' });
  }

  // TODO(db): executar numa transação (serviço + candidaturas).
  service.status = SERVICE_STATUS.CANCELLED;
  applications
    .filter((a) => a.service_id === service.id && a.status === APPLICATION_STATUS.PENDING)
    .forEach((a) => { a.status = APPLICATION_STATUS.REJECTED; });

  return res.status(200).json({ message: 'Service cancelled successfully!', service });
};

// RF03 - Aceita ou recusa uma candidatura
// Body: { application_id, action: 'Accept' | 'Reject' }
export const analyzeOffer: Handler<AnalyzeResponse, IdParams> = (req, res) => {
  const parsed = parseAnalyzeInput(toBody(req.body));
  if (!parsed.ok) {
    return res.status(parsed.status).json({ error: parsed.error });
  }
  const { application_id, action } = parsed.value;

  const service = findById(services, req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }

  const application = findById(applications, application_id);
  if (!application) {
    return res.status(404).json({ error: 'Candidatura não encontrada.' });
  }
  if (application.service_id !== service.id) {
    return res.status(400).json({ error: 'Esta candidatura não pertence a este serviço.' });
  }
  if (service.status !== SERVICE_STATUS.PENDING) {
    return res.status(409).json({ error: 'Este serviço não está mais aguardando trabalhador.' });
  }
  if (application.status !== APPLICATION_STATUS.PENDING) {
    return res.status(409).json({ error: 'Esta candidatura já foi analisada.' });
  }

  if (action === 'Reject') {
    application.status = APPLICATION_STATUS.REJECTED;
    return res.status(200).json({ message: 'Application rejected.', application });
  }

  // TODO(db): executar o aceite numa transação (candidatura + demais candidaturas + serviço).
  application.status = APPLICATION_STATUS.ACCEPTED;
  applications
    .filter((a) => a.service_id === service.id && a.id !== application.id && a.status === APPLICATION_STATUS.PENDING)
    // auto_rejected: recusada pelo aceite de outro; volta a Pending se o aceito desistir.
    .forEach((a) => { a.status = APPLICATION_STATUS.REJECTED; a.auto_rejected = true; });
  service.worker_id = application.worker_id;
  service.status = SERVICE_STATUS.IN_PROGRESS;

  return res.status(200).json({ message: 'Worker accepted successfully. Service is now in progress!', service, application });
};

// RF04 - Processa e libera o pagamento (simulação)
export const processPayment: Handler<PaymentResponse, IdParams> = (req, res) => {
  const service = findById(services, req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }
  if (service.status !== SERVICE_STATUS.IN_PROGRESS) {
    return res.status(409).json({ error: 'Só é possível pagar um serviço em andamento.' });
  }
  // Serviço em andamento sempre tem trabalhador (definido no aceite).
  const workerId = requireFound(service.worker_id ?? undefined, `trabalhador do serviço ${service.id}`);

  // TODO(db): criar o pagamento e concluir o serviço numa única transação.
  const payment: Payment = {
    id: nextId('payment'),
    service_id: service.id,
    farmer_id: service.farmer_id,
    worker_id: workerId,
    value: service.price,
    status: PAYMENT_STATUS.COMPLETED,
    insertion_date: new Date().toISOString()
  };
  payments.push(payment);

  service.payment_id = payment.id;
  service.status = SERVICE_STATUS.COMPLETED;

  return res.status(200).json({ message: 'Payment released and service completed successfully!', service, payment });
};

// --- LEITURAS ---

// GET /api/farmers/:id - Perfil completo do próprio produtor
export const getFarmer: Handler<Farmer, IdParams> = (req, res) => {
  const farmer = findById(farmers, req.params.id);
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }
  return res.status(200).json(farmer);
};

// GET /api/farmers/:id/farms - Fazendas ativas do produtor
export const listFarms: Handler<Farm[], IdParams> = (req, res) => {
  const farmer = findById(farmers, req.params.id);
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }
  return res.status(200).json(farms.filter((f) => f.farmer_id === farmer.id && isActiveFarm(f)));
};

// A fazenda de um serviço (mesmo arquivada) sempre existe enquanto o serviço existir.
function farmOf(service: Service): Farm {
  return requireFound(findById(farms, service.farm_id), `fazenda do serviço ${service.id}`);
}

// GET /api/farmers/:id/services?status= - Serviços do produtor
// Cada item traz a fazenda e a contagem de candidaturas pendentes.
export const listFarmerServices: Handler<FarmerServiceItem[], IdParams> = (req, res) => {
  const farmer = findById(farmers, req.params.id);
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  const rawStatus = req.query['status'];
  let status: ServiceStatus | undefined;
  if (rawStatus !== undefined) {
    if (!isServiceStatus(rawStatus)) {
      return res.status(400).json({ error: `Status inválido. Use um destes: ${serviceStatusList()}.` });
    }
    status = rawStatus;
  }

  const result = services
    .filter((s) => s.farmer_id === farmer.id && (status === undefined || s.status === status))
    .map((s): FarmerServiceItem => ({
      ...s,
      farm: farmOf(s),
      applications_pending: applications.filter(
        (a) => a.service_id === s.id && a.status === APPLICATION_STATUS.PENDING
      ).length
    }));

  return res.status(200).json(result);
};

// GET /api/farmers/services/:id - Serviço com a fazenda
export const getService: Handler<ServiceWithFarm, IdParams> = (req, res) => {
  const service = findById(services, req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }
  return res.status(200).json({ ...service, farm: farmOf(service) });
};

// GET /api/farmers/services/:id/applications - Candidaturas com o trabalhador embutido (CPF mascarado)
export const listServiceApplications: Handler<ApplicationWithWorker[], IdParams> = (req, res) => {
  const service = findById(services, req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }

  const result = applications
    .filter((a) => a.service_id === service.id)
    .map((a): ApplicationWithWorker => ({
      ...a,
      worker: toPublicProfile(requireFound(findById(workers, a.worker_id), `trabalhador da candidatura ${a.id}`))
    }));

  return res.status(200).json(result);
};
