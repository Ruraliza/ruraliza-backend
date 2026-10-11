// Histórico de demonstração para as avaliações e a conversa, criado depois das vagas abertas do seed
// (os serviços 1 a 7 continuam os mesmos). Tudo relativo ao relógio:
// - serviços já concluídos e avaliados pelos dois lados, para as fazendas e a Maria terem nota;
// - um concluído há 3 dias que a Maria já avaliou e o produtor ainda não (a nota dela fica escondida);
// - um concluído ontem, sem avaliações (pendente para os dois) e com a conversa ainda aberta;
// - um em andamento com a Maria, com conversa (a última mensagem do produtor ainda não lida por ela);
// - o Pedro, trabalhador com uma avaliação mediana, candidato à vaga 1 junto com o Carlos (sem avaliações).
import { HIRED_MESSAGE } from '#modules/chat';
import { windowEndsAt } from '#modules/reviews';
import { SERVICE_STATUS, type Service } from '#modules/services';
import { createAccount } from '#modules/accounts';
import type { PasswordHasher } from '#shared/domain/passwords';
import type { Repositories } from './repositories';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface HistoryPeople {
  farmerId: number;
  farmSaoJose: number;
  farmBoaVista: number;
  mariaId: number;
  carlosWorkerId: number;
}

interface PastJob {
  farmId: number;
  workerId: number;
  name: string;
  category: string;
  duration: number;
  price: number;
  paidDaysAgo: number;
}

type WorkerScores = [punctuality: number, effort: number, quality: number, comment: string | null];
type FarmScores = [infrastructure: number, conditions: number, as_described: number, comment: string | null];

export async function seedHistory(repos: Repositories, now: string, passwords: PasswordHasher, password: string, people: HistoryPeople): Promise<void> {
  const shift = (days: number): string => new Date(Date.parse(now) + days * DAY_MS).toISOString();
  const { farmerId, farmSaoJose, farmBoaVista, mariaId, carlosWorkerId } = people;

  const pedro = await repos.workers.create({
    email: 'pedro@exemplo.com',
    name: 'Pedro Diarista',
    bio: 'Faço de tudo um pouco: cerca, capina e colheita.',
    certificates: null,
    courses: null,
    experience: '3 anos',
    photo_url: null,
    resume_url: null,
    phone: '24966666666',
    cpf: '71428793860',
    insertion_date: shift(-60)
  });
  await createAccount(repos.accounts, passwords, { email: pedro.email, password, role: 'worker', profileId: pedro.id });

  // Serviço já pago: candidatura aceita, pagamento registrado e serviço concluído.
  async function completed(job: PastJob): Promise<{ service: Service; paidAt: string }> {
    const paidAt = shift(-job.paidDaysAgo);
    const service = await repos.services.create({
      farmer_id: farmerId, farm_id: job.farmId, worker_id: job.workerId, payment_id: null,
      name: job.name, description: null, category: job.category, duration: job.duration, price: job.price,
      expires_at: null, status: SERVICE_STATUS.COMPLETED, insertion_date: shift(-job.paidDaysAgo - 5)
    });
    await repos.applications.create({ service_id: service.id, worker_id: job.workerId, status: 'Accepted', insertion_date: shift(-job.paidDaysAgo - 4) });
    const payment = await repos.payments.create({
      service_id: service.id, farmer_id: farmerId, worker_id: job.workerId, value: job.price, status: 'Completed', insertion_date: paidAt
    });
    const paid = { ...service, payment_id: payment.id };
    await repos.services.update(paid);
    return { service: paid, paidAt };
  }

  async function reviewWorker(service: Service, paidAt: string, [punctuality, effort, quality, comment]: WorkerScores, revealed: boolean): Promise<void> {
    await repos.workerReviews.create({
      service_id: service.id, farmer_id: farmerId, worker_id: service.worker_id ?? 0, punctuality, effort, quality, comment,
      insertion_date: new Date(Date.parse(paidAt) + DAY_MS).toISOString(), window_ends_at: windowEndsAt(paidAt), revealed
    });
  }

  async function reviewFarm(service: Service, paidAt: string, [infrastructure, conditions, as_described, comment]: FarmScores, revealed: boolean): Promise<void> {
    await repos.farmReviews.create({
      service_id: service.id, farm_id: service.farm_id, farmer_id: farmerId, worker_id: service.worker_id ?? 0,
      infrastructure, conditions, as_described, comment,
      insertion_date: new Date(Date.parse(paidAt) + DAY_MS).toISOString(), window_ends_at: windowEndsAt(paidAt), revealed
    });
  }

  // Avaliados pelos dois lados (publicados).
  const milho = await completed({ farmId: farmSaoJose, workerId: mariaId, name: 'Colheita de milho', category: 'Colheita', duration: 32, price: 1400, paidDaysAgo: 40 });
  await reviewWorker(milho.service, milho.paidAt, [5, 5, 5, 'Chegou antes do horário e caprichou na colheita.'], true);
  await reviewFarm(milho.service, milho.paidAt, [5, 4, 5, 'Fazenda organizada, com água e sombra à vontade.'], true);

  const capina = await completed({ farmId: farmBoaVista, workerId: mariaId, name: 'Capina do cafezal', category: 'Manutenção', duration: 16, price: 640, paidDaysAgo: 25 });
  await reviewWorker(capina.service, capina.paidAt, [4, 5, 4, null], true);
  await reviewFarm(capina.service, capina.paidAt, [4, 3, 4, 'Faltou EPI no primeiro dia, mas resolveram rápido.'], true);

  const porteira = await completed({ farmId: farmSaoJose, workerId: pedro.id, name: 'Conserto de porteira', category: 'Manutenção', duration: 6, price: 280, paidDaysAgo: 30 });
  await reviewWorker(porteira.service, porteira.paidAt, [3, 4, 4, 'Atrasou na chegada, mas o serviço ficou bom.'], true);
  await reviewFarm(porteira.service, porteira.paidAt, [4, 5, 4, null], true);

  // A Maria já avaliou; a nota dela fica escondida até o produtor avaliar.
  const ordenha = await completed({ farmId: farmBoaVista, workerId: mariaId, name: 'Ordenha da manhã', category: 'Manejo de gado', duration: 12, price: 480, paidDaysAgo: 3 });
  await reviewFarm(ordenha.service, ordenha.paidAt, [5, 5, 5, 'Equipe muito receptiva.'], false);

  // Concluído ontem: os dois ainda vão avaliar; a conversa continua aberta.
  const pasto = await completed({ farmId: farmSaoJose, workerId: mariaId, name: 'Limpeza de pasto', category: 'Manutenção', duration: 8, price: 320, paidDaysAgo: 1 });
  const pastoChat = await repos.chats.create({
    service_id: pasto.service.id, farmer_id: farmerId, worker_id: mariaId, farmer_shares_phone: false, worker_shares_phone: false,
    farmer_read_up_to: 0, worker_read_up_to: 0, closes_at: shift(6), insertion_date: shift(-5)
  });
  let last = 0;
  for (const [sender, body, daysAgo] of [
    ['system', HIRED_MESSAGE, 5],
    ['worker', 'Terminei o pasto de cima. Amanhã faço o de baixo.', 2],
    ['system', 'Pagamento liberado. A conversa continua aberta por mais 7 dias.', 1]
  ] as const) {
    last = (await repos.chatMessages.create({ chat_id: pastoChat.id, sender, body, insertion_date: shift(-daysAgo) })).id;
  }
  await repos.chats.update({ ...pastoChat, farmer_read_up_to: last, worker_read_up_to: last });

  // Em andamento com a Maria, com conversa: a última mensagem do produtor ela ainda não leu.
  const curral = await repos.services.create({
    farmer_id: farmerId, farm_id: farmBoaVista, worker_id: mariaId, payment_id: null,
    name: 'Reforma do curral', description: 'Troca de tábuas e mourões do curral de manejo.', category: 'Manutenção',
    duration: 24, price: 960, expires_at: null, status: SERVICE_STATUS.IN_PROGRESS, insertion_date: shift(-6)
  });
  await repos.applications.create({ service_id: curral.id, worker_id: mariaId, status: 'Accepted', insertion_date: shift(-5) });
  const curralChat = await repos.chats.create({
    service_id: curral.id, farmer_id: farmerId, worker_id: mariaId, farmer_shares_phone: false, worker_shares_phone: false,
    farmer_read_up_to: 0, worker_read_up_to: 0, closes_at: null, insertion_date: shift(-2)
  });
  const ids: number[] = [];
  for (const [sender, body, hoursAgo] of [
    ['system', HIRED_MESSAGE, 48],
    ['farmer', 'Bom dia, Maria! Pode começar segunda às 7h?', 47],
    ['worker', 'Bom dia! Posso sim. Preciso levar alguma ferramenta?', 30],
    ['farmer', 'Só luvas. O resto a fazenda fornece, e o almoço é por nossa conta.', 2]
  ] as const) {
    ids.push((await repos.chatMessages.create({ chat_id: curralChat.id, sender, body, insertion_date: new Date(Date.parse(now) - hoursAgo * 3_600_000).toISOString() })).id);
  }
  await repos.chats.update({ ...curralChat, farmer_read_up_to: ids[3] ?? 0, worker_read_up_to: ids[2] ?? 0 });

  // Dois candidatos na vaga 1 (Colheita de café): o Pedro, com nota, e o Carlos, ainda sem avaliações.
  await repos.applications.create({ service_id: 1, worker_id: pedro.id, status: 'Pending', insertion_date: shift(-1) });
  await repos.applications.create({ service_id: 1, worker_id: carlosWorkerId, status: 'Pending', insertion_date: shift(0) });
}
