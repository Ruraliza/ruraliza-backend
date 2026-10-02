// Dados de demonstração criados ao subir o servidor (somem a cada reinício com os repositórios em memória).
// As datas são relativas ao relógio, então a demonstração vale em qualquer dia: há vagas publicadas em
// dias diferentes (filtros from/to e sort=recent) e com todos os casos de prazo (sem prazo, vence em
// alguns dias, vence hoje e já vencida).
import { SERVICE_STATUS } from '../constants/status';
import type { Clock } from '../domain/clock';
import { dayOf } from '../domain/dates';
import type { Repositories } from '../domain/repositories';

const DAY_MS = 24 * 60 * 60 * 1000;

interface DemoService {
  farmId: number;
  name: string;
  description: string;
  category: string;
  duration: number;
  price: number;
  publishedDaysAgo: number;
  expiresInDays: number | null; // null = sem prazo; negativo = já vencida
}

export async function seed(repos: Repositories, clock: Clock): Promise<void> {
  const now = clock.now();
  const shift = (days: number): string => new Date(Date.parse(now) + days * DAY_MS).toISOString();

  // Cadastros mais antigos que qualquer vaga.
  const registeredAt = shift(-30);

  const farmer = await repos.farmers.create({
    email: 'produtor@exemplo.com',
    name: 'João Produtor',
    farms: [],
    phone: '24999999999',
    cpf: '52998224725',
    photo_url: null,
    insertion_date: registeredAt
  });

  const farmSaoJose = await repos.farms.create({
    farmer_id: farmer.id, address: 'Estrada de Terra, Km 2', city: 'Três Rios', state: 'RJ',
    latitude: -22.1165, longitude: -43.2092, photos: [], insertion_date: registeredAt
  });
  const farmBoaVista = await repos.farms.create({
    farmer_id: farmer.id, address: 'Rodovia BR-040, Km 15', city: 'Paraíba do Sul', state: 'RJ',
    latitude: -22.1585, longitude: -43.2925, photos: [], insertion_date: registeredAt
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
    insertion_date: registeredAt
  });

  // Uma vaga por categoria (ver src/constants/categories.ts). Os serviços 1 a 3 são os citados na documentação.
  const demoServices: DemoService[] = [
    {
      farmId: farmSaoJose.id, name: 'Colheita de café', category: 'Colheita', duration: 40, price: 1800,
      description: 'Colheita manual do café arábica. Levar luvas e chapéu; a fazenda oferece almoço.',
      publishedDaysAgo: 2, expiresInDays: 10
    },
    {
      farmId: farmBoaVista.id, name: 'Plantio de milho', category: 'Plantio', duration: 24, price: 1200,
      description: 'Plantio em 3 hectares com plantadeira. Experiência com trator é um diferencial.',
      publishedDaysAgo: 5, expiresInDays: 3
    },
    {
      farmId: farmSaoJose.id, name: 'Conserto de cerca', category: 'Manutenção', duration: 8, price: 400,
      description: 'Troca de mourões e arame em cerca de pasto (cerca de 200 m).',
      publishedDaysAgo: 0, expiresInDays: null
    },
    {
      farmId: farmBoaVista.id, name: 'Pulverização de pasto', category: 'Pulverização', duration: 12, price: 650,
      description: 'Aplicação de herbicida com bomba costal em 5 hectares de pasto. EPI completo fornecido pela fazenda.',
      publishedDaysAgo: 1, expiresInDays: 0
    },
    {
      farmId: farmSaoJose.id, name: 'Roçada com trator', category: 'Operação de máquinas', duration: 16, price: 900,
      description: 'Roçada mecânica com trator e roçadeira hidráulica. Precisa ter carteira de tratorista.',
      publishedDaysAgo: 8, expiresInDays: null
    },
    {
      farmId: farmBoaVista.id, name: 'Vacinação do rebanho', category: 'Manejo de gado', duration: 6, price: 300,
      description: 'Apoio na vacinação contra aftosa de 120 cabeças no curral. Começa às 6h.',
      publishedDaysAgo: 3, expiresInDays: 7
    },
    {
      farmId: farmSaoJose.id, name: 'Limpeza de galpão', category: 'Outros', duration: 4, price: 180,
      description: 'Limpeza e organização do galpão de ferramentas antes da colheita.',
      publishedDaysAgo: 12, expiresInDays: -2 // vencida: some das vagas, mas o produtor ainda vê e pode renovar
    }
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
      expires_at: s.expiresInDays === null ? null : dayOf(shift(s.expiresInDays)),
      status: SERVICE_STATUS.PENDING,
      insertion_date: shift(-s.publishedDaysAgo)
    });
  }
}
