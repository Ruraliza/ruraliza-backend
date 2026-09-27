const { services } = require('../models/Service');
const { workers } = require('../models/Worker');
const { farms } = require('../models/Farm');
const { applications } = require('../models/ServiceApplication');
const { nextId } = require('../data/ids');
const { SERVICE_STATUS, APPLICATION_STATUS } = require('../constants/status');
const { validateProfileInput, normalizeEmail, toPublicProfile } = require('../utils/profile');

// GET /api/workers - Lista os trabalhadores (CPF mascarado)
exports.listWorkers = (req, res) => {
  return res.status(200).json(workers.map(toPublicProfile));
};

// POST /api/workers - Cadastra um novo trabalhador
exports.createWorker = (req, res) => {
  const invalid = validateProfileInput(req.body, workers);
  if (invalid) {
    return res.status(invalid.status).json({ error: invalid.error });
  }

  const { email, name, certificates, experience, phone, cpf } = req.body;
  const newWorker = {
    id: nextId('worker'),
    email: normalizeEmail(email),
    name: String(name).trim(),
    certificates: certificates || null,
    experience: experience || null,
    phone,
    cpf,
    insertion_date: new Date().toISOString()
  };

  workers.push(newWorker);

  return res.status(201).json({ message: 'Worker created successfully!', worker: newWorker });
};

// RF02 - Busca serviços disponíveis
exports.searchServices = (req, res) => {
  const { category } = req.query;

  let pendingServices = services.filter((s) => s.status === SERVICE_STATUS.PENDING);
  if (category) {
    pendingServices = pendingServices.filter((s) => s.category === category);
  }

  return res.status(200).json(pendingServices.map(withFarmLocation));
};

// RF02 - Candidata-se a um serviço
exports.applyForService = (req, res) => {
  const service_id = Number(req.params.id);
  const { worker_id } = req.body;

  if (!worker_id) {
    return res.status(400).json({ error: 'Informe o worker_id.' });
  }

  const service = services.find((s) => s.id === service_id);
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }

  const worker = workers.find((w) => w.id === Number(worker_id));
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }

  if (service.status !== SERVICE_STATUS.PENDING) {
    return res.status(409).json({ error: 'Este serviço não está mais aberto para candidaturas.' });
  }

  // TODO(db): trocar por restrição UNIQUE (service_id, worker_id) no banco.
  const alreadyApplied = applications.some((a) => a.service_id === service_id && a.worker_id === worker.id);
  if (alreadyApplied) {
    return res.status(409).json({ error: 'Você já se candidatou a este serviço.' });
  }

  const newApplication = {
    id: nextId('application'),
    service_id,
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
function withFarmLocation(service) {
  const farm = farms.find((f) => f.id === service.farm_id);
  return { ...service, farm: { city: farm.city, state: farm.state } };
}

// GET /api/workers/:id - Perfil completo do próprio trabalhador
exports.getWorker = (req, res) => {
  const worker = workers.find((w) => w.id === Number(req.params.id));
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }
  return res.status(200).json(worker);
};

// GET /api/workers/:id/applications - Candidaturas com o serviço embutido
exports.listWorkerApplications = (req, res) => {
  const worker = workers.find((w) => w.id === Number(req.params.id));
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }

  const result = applications
    .filter((a) => a.worker_id === worker.id)
    .map((a) => ({ ...a, service: withFarmLocation(services.find((s) => s.id === a.service_id)) }));

  return res.status(200).json(result);
};

// GET /api/workers/:id/services - Serviços atribuídos ao trabalhador
exports.listWorkerServices = (req, res) => {
  const worker = workers.find((w) => w.id === Number(req.params.id));
  if (!worker) {
    return res.status(404).json({ error: 'Trabalhador não encontrado.' });
  }
  return res.status(200).json(services.filter((s) => s.worker_id === worker.id).map(withFarmLocation));
};

// GET /api/workers/services/:id - Detalhe da vaga com cidade/UF da fazenda
exports.getServiceDetail = (req, res) => {
  const service = services.find((s) => s.id === Number(req.params.id));
  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado.' });
  }
  return res.status(200).json(withFarmLocation(service));
};
