// Dados de demonstração criados em memória ao subir o servidor.
// Somem a cada reinício.
import type { Farm, Farmer, Service } from '../contracts';
import { SERVICE_STATUS } from '../constants/status';
import { farms } from '../models/Farm';
import { farmers } from '../models/Farmer';
import { services } from '../models/Service';
import { workers } from '../models/Worker';
import { nextId } from './ids';

interface DemoService {
  farm: Farm;
  name: string;
  category: string;
  duration: number;
  price: number;
}

export function seed(): void {
  const now = new Date().toISOString();

  const farmer: Farmer = {
    id: nextId('farmer'),
    email: 'produtor@exemplo.com',
    name: 'João Produtor',
    farms: [],
    phone: '24999999999',
    cpf: '52998224725',
    insertion_date: now
  };
  farmers.push(farmer);

  const farmSaoJose: Farm = { id: nextId('farm'), farmer_id: farmer.id, address: 'Estrada de Terra, Km 2', city: 'Três Rios', state: 'RJ', insertion_date: now };
  const farmBoaVista: Farm = { id: nextId('farm'), farmer_id: farmer.id, address: 'Rodovia BR-040, Km 15', city: 'Paraíba do Sul', state: 'RJ', insertion_date: now };
  farms.push(farmSaoJose, farmBoaVista);
  farmer.farms = [farmSaoJose.id, farmBoaVista.id];

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

  const demoServices: DemoService[] = [
    { farm: farmSaoJose, name: 'Colheita de café', category: 'Colheita', duration: 40, price: 1800 },
    { farm: farmBoaVista, name: 'Plantio de milho', category: 'Plantio', duration: 24, price: 1200 },
    { farm: farmSaoJose, name: 'Conserto de cerca', category: 'Manutenção', duration: 8, price: 400 }
  ];

  for (const s of demoServices) {
    const service: Service = {
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
    };
    services.push(service);
  }
}
