// Dados de demonstração criados em memória ao subir o servidor.
// Somem a cada reinício.
const { farmers } = require('../models/Farmer');
const { workers } = require('../models/Worker');
const { farms } = require('../models/Farm');
const { services } = require('../models/Service');
const { nextId } = require('./ids');
const { SERVICE_STATUS } = require('../constants/status');

function seed() {
  const now = new Date().toISOString();

  const farmer = {
    id: nextId('farmer'),
    email: 'produtor@exemplo.com',
    name: 'João Produtor',
    farms: 0,
    phone: '24999999999',
    cpf: '52998224725',
    insertion_date: now
  };
  farmers.push(farmer);

  const farmSaoJose = { id: nextId('farm'), farmer_id: farmer.id, address: 'Estrada de Terra, Km 2', city: 'Três Rios', state: 'RJ', insertion_date: now };
  const farmBoaVista = { id: nextId('farm'), farmer_id: farmer.id, address: 'Rodovia BR-040, Km 15', city: 'Paraíba do Sul', state: 'RJ', insertion_date: now };
  farms.push(farmSaoJose, farmBoaVista);
  farmer.farms = 2;

  workers.push({
    id: nextId('worker'),
    email: 'trabalhador@exemplo.com',
    name: 'Maria Trabalhadora',
    certificates: 'Certificado de Tratorista',
    experience: '5 anos',
    phone: '24988888888',
    cpf: '11144477735',
    insertion_date: now
  });

  const demoServices = [
    { farm: farmSaoJose, name: 'Colheita de café', category: 'Colheita', duration: 40, price: 1800 },
    { farm: farmBoaVista, name: 'Plantio de milho', category: 'Plantio', duration: 24, price: 1200 },
    { farm: farmSaoJose, name: 'Conserto de cerca', category: 'Manutenção', duration: 8, price: 400 }
  ];

  for (const s of demoServices) {
    services.push({
      id: nextId('service'),
      farmer_id: farmer.id,
      farm_id: s.farm.id,
      worker_id: null,
      payment_id: null,
      name: s.name,
      category: s.category,
      duration: s.duration,
      price: s.price,
      status: SERVICE_STATUS.PENDING,
      insertion_date: now
    });
  }
}

module.exports = { seed };
