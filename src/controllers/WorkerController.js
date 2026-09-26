const { services } = require('../models/Service');

// RF02 - Browse and search for services[cite: 3]
exports.searchServices = (req, res) => {
  try {
    const { category } = req.query;
    
    // Filtra serviços pendentes
    let pendingServices = services.filter(s => s.status === 'Pending');
    
    // Filtra por categoria, se fornecida
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

    // Em memória, apenas simulamos a candidatura (não estamos guardando num array de candidaturas)
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