const { services } = require('../models/Service');
const { workers } = require('../models/Worker'); // Importação da tabela em memória

// GET /api/workers - Retorna a lista de prestadores/trabalhadores
exports.listWorkers = (req, res) => {
  try {
    return res.status(200).json(workers);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while fetching workers.' });
  }
};

// POST /api/workers - Cadastra um novo prestador
exports.createWorker = (req, res) => {
  try {
    const { email, name, certificates, experience, phone, cpf } = req.body;

    if (!email || !name || !phone || !cpf) {
      return res.status(400).json({ error: 'Missing required fields: email, name, phone, or cpf.' });
    }

    const newWorker = {
      id: Date.now(), // Gera um ID único provisório em memória
      email,
      name,
      certificates: certificates || null,
      experience: experience || null,
      phone,
      cpf,
      insertion_date: new Date().toISOString()
    };

    workers.push(newWorker);

    return res.status(201).json({
      message: 'Worker created successfully!',
      worker: newWorker
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while creating worker.' });
  }
};

// RF02 - Browse and search for services[cite: 3]
exports.searchServices = (req, res) => {
  try {
    const { category } = req.query; 
    
    let pendingServices = services.filter(s => s.status === 'Pending');
    
    if (category) {
      pendingServices = pendingServices.filter(s => s.category === category);
    }

    return res.status(200).json(pendingServices);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while fetching services.' });
  }
};

// RF02 - Send execution request (Apply)[cite: 3]
exports.applyForService = (req, res) => {
  try {
    const id = parseInt(req.params.id); // Service ID
    const { worker_id } = req.body;

    const service = services.find(s => s.id === id);

    if (!service || service.status !== 'Pending') {
      return res.status(400).json({ error: 'Service is unavailable for application.' });
    }

    return res.status(200).json({
      message: 'Application sent successfully! Wait for the farmer\'s approval.',
      service_id: id,
      worker_id
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while applying for service.' });
  }
};