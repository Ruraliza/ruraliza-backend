const { services } = require('../models/Service');
const { farmers } = require('../models/Farmer');
const { farms } = require('../models/Farm');
const { applications } = require('../models/ServiceApplication');
const { payments } = require('../models/Payment');
const { workers } = require('../models/Worker');
const { nextId } = require('../data/ids');
const { SERVICE_STATUS, APPLICATION_STATUS, PAYMENT_STATUS } = require('../constants/status');
const { isPositiveNumber, missingFields } = require('../utils/validation');
const { validateProfileInput, validateProfileUpdate, normalizeEmail, toPublicProfile } = require('../utils/profile');

// Erros inesperados sobem para o handler global (o Express 5 repassa exceções).

const ANALYZE_ACTIONS = ['Accept', 'Reject'];

// GET /api/farmers - Lista os produtores (CPF mascarado)
exports.listFarmers = (req, res) => {
  return res.status(200).json(farmers.map(toPublicProfile));
};

// POST /api/farmers - Cadastra um novo produtor
exports.createFarmer = (req, res) => {
  const invalid = validateProfileInput(req.body, farmers);
  if (invalid) {
    return res.status(invalid.status).json({ error: invalid.error });
  }

  const { email, name, phone, cpf } = req.body;
  const newFarmer = {
    id: nextId('farmer'),
    email: normalizeEmail(email),
    name: String(name).trim(),
    farms: [],
    phone,
    cpf,
    insertion_date: new Date().toISOString()
  };

  farmers.push(newFarmer);

  return res.status(201).json({ message: 'Farmer created successfully!', farmer: newFarmer });
};

// PATCH /api/farmers/:id - Edita o produtor (id e cpf não podem ser alterados)
exports.updateFarmer = (req, res) => {
  const farmer = farmers.find((f) => f.id === Number(req.params.id));
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  const invalid = validateProfileUpdate(req.body, farmers, farmer.id);
  if (invalid) {
    return res.status(invalid.status).json({ error: invalid.error });
  }

  const { email, name, phone } = req.body;
  if (email !== undefined) farmer.email = normalizeEmail(email);
  if (name !== undefined) farmer.name = String(name).trim();
  if (phone !== undefined) farmer.phone = phone;

  return res.status(200).json({ message: 'Farmer updated successfully!', farmer });
};

// DELETE /api/farmers/:id - Remove o produtor
exports.deleteFarmer = (req, res) => {
  const index = farmers.findIndex((f) => f.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  farmers.splice(index, 1);

  return res.status(200).json({ message: 'Farmer deleted successfully!' });
};

// POST /api/farmers/:id/farms - Cadastra uma nova fazenda para um produtor
exports.createFarm = (req, res) => {
  const farmer_id = Number(req.params.id);

  const missing = missingFields(req.body, ['address', 'city', 'state']);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Preencha os campos obrigatórios: ${missing.join(', ')}.` });
  }

  const farmer = farmers.find((f) => f.id === farmer_id);
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  const { address, city, state } = req.body;
  const newFarm = {
    id: nextId('farm'),
    farmer_id,
    address,
    city,
    state,
    insertion_date: new Date().toISOString()
  };

  farms.push(newFarm);
  farmer.farms.push(newFarm.id);

  return res.status(201).json({ message: 'Farm registered successfully!', farm: newFarm });
};

// RF01 - Cadastra demanda com atividade, local e valor
exports.requestService = (req, res) => {
  const missing = missingFields(req.body, ['farmer_id', 'farm_id', 'name', 'category', 'duration', 'price']);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Preencha os campos obrigatórios: ${missing.join(', ')}.` });
  }

  const { farmer_id, farm_id, name, category, duration, price } = req.body;

  if (!isPositiveNumber(duration)) {
    return res.status(400).json({ error: 'A duração deve ser um número de horas maior que zero.' });
  }
  if (!isPositiveNumber(price)) {
    return res.status(400).json({ error: 'O valor deve ser um número maior que zero.' });
  }

  const farmer = farmers.find((f) => f.id === Number(farmer_id));
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  const farm = farms.find((f) => f.id === Number(farm_id));
  if (!farm) {
    return res.status(404).json({ error: 'Fazenda não encontrada.' });
  }
  if (farm.farmer_id !== farmer.id) {
    return res.status(400).json({ error: 'Esta fazenda não pertence a este produtor.' });
  }

  const newService = {
    id: nextId('service'),
    farmer_id: farmer.id,
    farm_id: farm.id,
    worker_id: null,
    payment_id: null,
    name: String(name).trim(),
    category,
    duration,
    price,
    status: SERVICE_STATUS.PENDING,
    insertion_date: new Date().toISOString()
  };

  services.push(newService);

  return res.status(201).json({ message: 'Service requested successfully!', service: newService });
};

// RF03 - Aceita ou recusa uma candidatura
// Body: { application_id, action: 'Accept' | 'Reject' }
exports.analyzeOffer = (req, res) => {
  const id = Number(req.params.id);
  const { application_id, action } = req.body;

  if (!ANALYZE_ACTIONS.includes(action)) {
    return res.status(400).json({ error: "A ação deve ser 'Accept' ou 'Reject'." });
  }
  if (!application_id) {
    return res.status(400).json({ error: 'Informe o application_id.' });
  }

  const service = services.find((s) => s.id === id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }

  const application = applications.find((a) => a.id === Number(application_id));
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
    .forEach((a) => { a.status = APPLICATION_STATUS.REJECTED; });
  service.worker_id = application.worker_id;
  service.status = SERVICE_STATUS.IN_PROGRESS;

  return res.status(200).json({ message: 'Worker accepted successfully. Service is now in progress!', service, application });
};

// RF04 - Processa e libera o pagamento (simulação)
exports.processPayment = (req, res) => {
  const id = Number(req.params.id);

  const service = services.find((s) => s.id === id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }
  if (service.status !== SERVICE_STATUS.IN_PROGRESS) {
    return res.status(409).json({ error: 'Só é possível pagar um serviço em andamento.' });
  }

  // TODO(db): criar o pagamento e concluir o serviço numa única transação.
  const payment = {
    id: nextId('payment'),
    service_id: service.id,
    farmer_id: service.farmer_id,
    worker_id: service.worker_id,
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
exports.getFarmer = (req, res) => {
  const farmer = farmers.find((f) => f.id === Number(req.params.id));
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }
  return res.status(200).json(farmer);
};

// GET /api/farmers/:id/farms - Fazendas do produtor
exports.listFarms = (req, res) => {
  const farmer = farmers.find((f) => f.id === Number(req.params.id));
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }
  return res.status(200).json(farms.filter((f) => f.farmer_id === farmer.id));
};

// GET /api/farmers/:id/services?status= - Serviços do produtor
// Cada item traz a fazenda e a contagem de candidaturas pendentes.
exports.listFarmerServices = (req, res) => {
  const farmer = farmers.find((f) => f.id === Number(req.params.id));
  if (!farmer) {
    return res.status(404).json({ error: 'Produtor não encontrado.' });
  }

  const { status } = req.query;
  if (status !== undefined && !Object.values(SERVICE_STATUS).includes(status)) {
    return res.status(400).json({ error: `Status inválido. Use um destes: ${Object.values(SERVICE_STATUS).join(', ')}.` });
  }

  const result = services
    .filter((s) => s.farmer_id === farmer.id && (status === undefined || s.status === status))
    .map((s) => ({
      ...s,
      farm: farms.find((f) => f.id === s.farm_id),
      applications_pending: applications.filter(
        (a) => a.service_id === s.id && a.status === APPLICATION_STATUS.PENDING
      ).length
    }));

  return res.status(200).json(result);
};

// GET /api/farmers/services/:id - Serviço com a fazenda
exports.getService = (req, res) => {
  const service = services.find((s) => s.id === Number(req.params.id));
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }
  return res.status(200).json({ ...service, farm: farms.find((f) => f.id === service.farm_id) });
};

// GET /api/farmers/services/:id/applications - Candidaturas com o trabalhador embutido (CPF mascarado)
exports.listServiceApplications = (req, res) => {
  const service = services.find((s) => s.id === Number(req.params.id));
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }

  const result = applications
    .filter((a) => a.service_id === service.id)
    .map((a) => ({ ...a, worker: toPublicProfile(workers.find((w) => w.id === a.worker_id)) }));

  return res.status(200).json(result);
};
