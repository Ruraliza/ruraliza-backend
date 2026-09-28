// Dados de demonstração criados ao subir o servidor (somem a cada reinício com os repositórios em memória).
import { SERVICE_STATUS } from '../constants/status';
import type { Clock } from '../domain/clock';
import type { Repositories } from '../domain/repositories';

interface DemoService {
  farmId: number;
  name: string;
  description: string;
  category: string;
  duration: number;
  price: number;
}

export async function seed(repos: Repositories, clock: Clock): Promise<void> {
  const now = clock.now();

  const farmer = await repos.farmers.create({
    email: 'produtor@exemplo.com',
    name: 'João Produtor',
    farms: [],
    phone: '24999999999',
    cpf: '52998224725',
    photo_url: null,
    insertion_date: now
  });

  const farmSaoJose = await repos.farms.create({
    farmer_id: farmer.id, address: 'Estrada de Terra, Km 2', city: 'Três Rios', state: 'RJ', photos: [], insertion_date: now
  });
  const farmBoaVista = await repos.farms.create({
    farmer_id: farmer.id, address: 'Rodovia BR-040, Km 15', city: 'Paraíba do Sul', state: 'RJ', photos: [], insertion_date: now
  });
  farmer.farms = [farmSaoJose.id, farmBoaVista.id];
  await repos.farmers.update(farmer);

  await repos.workers.create({
    email: 'trabalhador@exemplo.com',
    name: 'Maria Trabalhadora',
    bio: 'Trabalho no campo desde nova. Disponível de segunda a sábado.',
    certificates: 'Certificado de Tratorista',
    courses: 'NR-31 Segurança no trabalho rural',
    experience: '5 anos',
    photo_url: null,
    phone: '24988888888',
    cpf: '11144477735',
    insertion_date: now
  });

  const demoServices: DemoService[] = [
    { farmId: farmSaoJose.id, name: 'Colheita de café', description: 'Colheita manual do café arábica. Levar luvas e chapéu; a fazenda oferece almoço.', category: 'Colheita', duration: 40, price: 1800 },
    { farmId: farmBoaVista.id, name: 'Plantio de milho', description: 'Plantio em 3 hectares com plantadeira. Experiência com trator é um diferencial.', category: 'Plantio', duration: 24, price: 1200 },
    { farmId: farmSaoJose.id, name: 'Conserto de cerca', description: 'Troca de mourões e arame em cerca de pasto (cerca de 200 m).', category: 'Manutenção', duration: 8, price: 400 }
  ];

  for (const s of demoServices) {
    await repos.services.create({
      farmer_id: farmer.id,
      farm_id: s.farmId,
      worker_id: null,
      payment_id: null,
      name: s.name,
      description: s.description,
      category: s.category,
      duration: s.duration,
      price: s.price,
      expires_at: null,
      status: SERVICE_STATUS.PENDING,
      insertion_date: now
    });
  }
}
