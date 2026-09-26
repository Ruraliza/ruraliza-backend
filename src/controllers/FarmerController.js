const { services, nextId: nextServiceId } = require('../models/Service');
const { workers } = require('../models/Worker'); 
const { farmers } = require('../models/Farmer'); // Importação da tabela de produtores
const { farms } = require('../models/Farm');

// GET /api/farmers - Retorna a lista de produtores
exports.listFarmers = (req, res) => {
  try {
    return res.status(200).json(farmers);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while fetching farmers.' });
  }
};

// POST /api/farmers - Regista um novo produtor
exports.createFarmer = (req, res) => {
  try {
    const { email, name, farms, phone, cpf } = req.body;

    if (!email || !name || !phone || !cpf) {
      return res.status(400).json({ error: 'Missing required fields: email, name, phone, or cpf.' });
    }

    const newFarmer = {
      id: Date.now(), // Gera um ID único provisório em memória
      email,
      name,
      farms: farms || null,
      phone,
      cpf,
      insertion_date: new Date().toISOString()
    };

    farmers.push(newFarmer);

    return res.status(201).json({
      message: 'Farmer created successfully!',
      farmer: newFarmer
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while creating farmer.' });
  }
};

// POST /api/farmers/:id/farms - Regista uma nova fazenda para um produtor
// {
//   "address": "Estrada de Terra, Km 2",
//   "city": "Três Rios",
//   "state": "RJ"
// }
exports.createFarm = (req, res) => {
  try {
    const farmer_id = parseInt(req.params.id); // Pega o ID da URL
    const { address, city, state } = req.body;

    // Validação dos dados da fazenda
    if (!address || !city || !state) {
      return res.status(400).json({ error: 'Missing required fields: address, city, or state.' });
    }

    // Verifica se o produtor existe em memória
    const farmerIndex = farmers.findIndex(f => f.id === farmer_id);
    if (farmerIndex === -1) {
      return res.status(404).json({ error: 'Farmer not found.' });
    }

    const newFarm = {
      id: Date.now(),
      farmer_id, 
      address,
      city,
      state,
      insertion_date: new Date().toISOString()
    };

    farms.push(newFarm);

    // Opcional: Atualiza a contagem de fazendas no objeto do Produtor
    farmers[farmerIndex].farms = (farmers[farmerIndex].farms || 0) + 1;

    return res.status(201).json({
      message: 'Farm registered successfully!',
      farm: newFarm
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while registering farm.' });
  }
};

// RF01 - Register demand specifying activity, location, and value[cite: 3]
exports.requestService = (req, res) => {
  try {
    const { farmer_id, farm_id, name, category, duration, price } = req.body;

    const newService = {
      id: Date.now(),
      farmer_id,
      farm_id,
      worker_id: null, // Ainda não aceite por ninguém
      name,
      category,
      duration,
      price,
      status: 'Pending',
      insertion_date: new Date().toISOString()
    };

    services.push(newService);

    return res.status(201).json({
      message: 'Service requested successfully!',
      service: newService
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while requesting service.' });
  }
};

// RF03 - Evaluate profile/qualification and approve the professional[cite: 3]
exports.analyzeOffer = (req, res) => {
  try {
    const id = parseInt(req.params.id); // Service ID
    const { worker_id, action } = req.body; // 'action' can be 'Accept' or 'Reject'

    const serviceIndex = services.findIndex(s => s.id === id);

    if (serviceIndex === -1) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    if (action === 'Accept') {
      services[serviceIndex].worker_id = worker_id;
      services[serviceIndex].status = 'In Progress';

      return res.status(200).json({
        message: 'Worker accepted successfully. Service is now in progress!',
        service: services[serviceIndex]
      });
    }

    return res.status(200).json({ message: 'Offer rejected by the farmer.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while analyzing offer.' });
  }
};

// RF04 - Process and release payment via app[cite: 3]
exports.processPayment = (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const serviceIndex = services.findIndex(s => s.id === id);
    if (serviceIndex === -1) {
      return res.status(404).json({ error: 'Service not found.' });
    }

    services[serviceIndex].status = 'Completed';

    return res.status(200).json({
      message: 'Payment released and service completed successfully!',
      service: services[serviceIndex]
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal error while processing payment.' });
  }
};