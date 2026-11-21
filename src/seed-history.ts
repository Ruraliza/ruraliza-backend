// Histórico de demonstração para as avaliações e a conversa, criado depois das vagas abertas do seed
// (os serviços 1 a 7 continuam os mesmos). Tudo relativo ao relógio:
// - serviços já pagos (com estimativa na vaga, proposta aceita, o combinado e o total coerente com ele) e avaliados pelos
//   dois lados, para as fazendas e a Maria terem nota;
// - um pago há 3 dias que a Maria já avaliou e o produtor ainda não (a nota dela fica escondida);
// - um pago ontem, sem avaliações (pendente para os dois) e com a conversa ainda aberta;
// - um em andamento com a Maria, contratado pela proposta aceita na conversa (a última mensagem do produtor ainda não lida por ela);
// - o Pedro, trabalhador com uma avaliação mediana, candidato à vaga 1 junto com o Carlos (sem avaliações). Com o Pedro, a
//   conversa está em negociação: ele propôs um valor e o produtor ainda não respondeu;
// - a central de notificações do João e da Maria com os avisos que essa história teria gerado.
import { HIRED_MESSAGE, OPENED_MESSAGE } from '#modules/chat';
import { windowEndsAt } from '#modules/reviews';
import { type PriceUnit, SERVICE_STATUS, type Service, describeTerms, money } from '#modules/services';
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
  estimate: number; // o valor estimado da vaga, na mesma unidade do combinado
  amount: number; // o combinado na proposta aceita, por `unit`
  unit: PriceUnit;
  total: number; // o que o produtor liberou no pagamento (coerente com o combinado e as horas)
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

  // Serviço pago: vaga com estimativa, candidatura e proposta aceitas (o combinado fica no serviço) e o pagamento
  // (simulado) do total, há `paidDaysAgo` dias, que concluiu o serviço.
  async function completed(job: PastJob): Promise<{ service: Service; doneAt: string }> {
    const doneAt = shift(-job.paidDaysAgo);
    const agreedAt = shift(-job.paidDaysAgo - 4);
    const service = await repos.services.create({
      farmer_id: farmerId, farm_id: job.farmId, worker_id: job.workerId, payment_id: null, proposal_id: null, agreement: null, completed_at: doneAt,
      name: job.name, description: null, category: job.category, duration: job.duration, price: job.estimate, price_unit: job.unit,
      expires_at: null, status: SERVICE_STATUS.COMPLETED, insertion_date: shift(-job.paidDaysAgo - 5)
    });
    const application = await repos.applications.create({ service_id: service.id, worker_id: job.workerId, status: 'Accepted', insertion_date: shift(-job.paidDaysAgo - 4.5) });
    const terms = { amount: job.amount, unit: job.unit, notes: null } as const;
    const proposal = await repos.proposals.create({
      ...terms, application_id: application.id, service_id: service.id, farmer_id: farmerId, worker_id: job.workerId,
      proposed_by: 'worker', status: 'Accepted', insertion_date: shift(-job.paidDaysAgo - 4.2), answered_at: agreedAt
    });
    const payment = await repos.payments.create({
      service_id: service.id, farmer_id: farmerId, worker_id: job.workerId, value: job.total, status: 'Completed', insertion_date: doneAt
    });
    const paid = { ...service, payment_id: payment.id, proposal_id: proposal.id, agreement: { ...terms, agreed_at: agreedAt } };
    await repos.services.update(paid);
    return { service: paid, doneAt };
  }

  async function reviewWorker(service: Service, doneAt: string, [punctuality, effort, quality, comment]: WorkerScores, revealed: boolean): Promise<void> {
    await repos.workerReviews.create({
      service_id: service.id, farmer_id: farmerId, worker_id: service.worker_id ?? 0, punctuality, effort, quality, comment,
      insertion_date: new Date(Date.parse(doneAt) + DAY_MS).toISOString(), window_ends_at: windowEndsAt(doneAt), revealed
    });
  }

  async function reviewFarm(service: Service, doneAt: string, [infrastructure, conditions, as_described, comment]: FarmScores, revealed: boolean): Promise<void> {
    await repos.farmReviews.create({
      service_id: service.id, farm_id: service.farm_id, farmer_id: farmerId, worker_id: service.worker_id ?? 0,
      infrastructure, conditions, as_described, comment,
      insertion_date: new Date(Date.parse(doneAt) + DAY_MS).toISOString(), window_ends_at: windowEndsAt(doneAt), revealed
    });
  }

  // Avaliados pelos dois lados (publicados).
  const milho = await completed({ farmId: farmSaoJose, workerId: mariaId, name: 'Colheita de milho', category: 'Colheita', duration: 32, estimate: 160, amount: 175, unit: 'day', total: 700, paidDaysAgo: 40 });
  await reviewWorker(milho.service, milho.doneAt, [5, 5, 5, 'Chegou antes do horário e caprichou na colheita.'], true);
  await reviewFarm(milho.service, milho.doneAt, [5, 4, 5, 'Fazenda organizada, com água e sombra à vontade.'], true);

  const capina = await completed({ farmId: farmBoaVista, workerId: mariaId, name: 'Capina do cafezal', category: 'Capina', duration: 16, estimate: 35, amount: 40, unit: 'hour', total: 640, paidDaysAgo: 25 });
  await reviewWorker(capina.service, capina.doneAt, [4, 5, 4, null], true);
  await reviewFarm(capina.service, capina.doneAt, [4, 3, 4, 'Faltou EPI no primeiro dia, mas resolveram rápido.'], true);

  const porteira = await completed({ farmId: farmSaoJose, workerId: pedro.id, name: 'Conserto de porteira', category: 'Porteiras e colchetes', duration: 6, estimate: 250, amount: 280, unit: 'fixed', total: 280, paidDaysAgo: 30 });
  await reviewWorker(porteira.service, porteira.doneAt, [3, 4, 4, 'Atrasou na chegada, mas o serviço ficou bom.'], true);
  await reviewFarm(porteira.service, porteira.doneAt, [4, 5, 4, null], true);

  // A Maria já avaliou; a nota dela fica escondida até o produtor avaliar.
  const ordenha = await completed({ farmId: farmBoaVista, workerId: mariaId, name: 'Ordenha da manhã', category: 'Ordenha', duration: 12, estimate: 40, amount: 40, unit: 'hour', total: 480, paidDaysAgo: 3 });
  await reviewFarm(ordenha.service, ordenha.doneAt, [5, 5, 5, 'Equipe muito receptiva.'], false);

  // Concluído ontem: os dois ainda vão avaliar; a conversa continua aberta.
  const pasto = await completed({ farmId: farmSaoJose, workerId: mariaId, name: 'Limpeza de pasto', category: 'Limpeza de pasto', duration: 8, estimate: 150, amount: 160, unit: 'hectare', total: 320, paidDaysAgo: 1 });
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
    farmer_id: farmerId, farm_id: farmBoaVista, worker_id: mariaId, payment_id: null, proposal_id: null, agreement: null, completed_at: null, price: 150, price_unit: 'day',
    name: 'Reforma do curral', description: 'Troca de tábuas e mourões do curral de manejo.', category: 'Curral, brete e tronco',
    duration: 24, expires_at: null, status: SERVICE_STATUS.IN_PROGRESS, insertion_date: shift(-6)
  });
  const curralApp = await repos.applications.create({
    service_id: curral.id, worker_id: mariaId, status: 'Accepted', message: 'Já reformei dois currais. Levo minhas ferramentas.', insertion_date: shift(-5)
  });
  const hours = (h: number): string => new Date(Date.parse(now) - h * 3_600_000).toISOString();
  const agreed = await repos.proposals.create({
    application_id: curralApp.id, service_id: curral.id, farmer_id: farmerId, worker_id: mariaId, amount: 160, unit: 'day', notes: 'Almoço por conta da fazenda.', proposed_by: 'farmer', status: 'Accepted',
    insertion_date: hours(52), answered_at: hours(50)
  });
  await repos.services.update({
    ...curral, proposal_id: agreed.id,
    agreement: { amount: 160, unit: 'day', notes: 'Almoço por conta da fazenda.', agreed_at: hours(50) }
  });
  const curralChat = await repos.chats.create({
    service_id: curral.id, farmer_id: farmerId, worker_id: mariaId, farmer_shares_phone: false, worker_shares_phone: false,
    farmer_read_up_to: 0, worker_read_up_to: 0, closes_at: null, insertion_date: hours(54)
  });
  const ids: number[] = [];
  for (const [sender, body, hoursAgo, proposalId] of [
    ['system', OPENED_MESSAGE, 54, undefined],
    ['farmer', 'Oi, Maria! Vi sua mensagem. Quantos dias você acha que leva?', 53, undefined],
    ['worker', 'Uns três dias, se o tempo ajudar.', 52.5, undefined],
    ['system', `João propôs ${describeTerms(agreed)}.`, 52, agreed.id],
    ['system', `Maria aceitou a proposta de ${describeTerms(agreed)}. Agora o produtor pode aceitar a candidatura.`, 50, agreed.id],
    ['system', `${HIRED_MESSAGE} Combinado: ${describeTerms(agreed)}.`, 48, undefined],
    ['farmer', 'Bom dia, Maria! Pode começar segunda às 7h?', 47, undefined],
    ['worker', 'Bom dia! Posso sim. Preciso levar alguma ferramenta?', 30],
    ['farmer', 'Só luvas. O resto a fazenda fornece, e o almoço é por nossa conta.', 2, undefined]
  ] as const) {
    ids.push((await repos.chatMessages.create({
      chat_id: curralChat.id, sender, body, ...(proposalId === undefined ? {} : { proposal_id: proposalId }), insertion_date: hours(hoursAgo)
    })).id);
  }
  await repos.chats.update({ ...curralChat, farmer_read_up_to: ids.at(-1) ?? 0, worker_read_up_to: ids.at(-2) ?? 0 });

  // Dois candidatos na vaga 1 (Colheita de café): o Pedro, com nota, e o Carlos, ainda sem avaliações.
  // Com o Pedro, a conversa está em negociação: ele propôs e o produtor ainda não respondeu.
  const pedroApp = await repos.applications.create({
    service_id: 1, worker_id: pedro.id, status: 'Pending', message: 'Já colhi café 3 safras. Posso a partir de segunda.', insertion_date: shift(-1)
  });
  await repos.applications.create({ service_id: 1, worker_id: carlosWorkerId, status: 'Pending', insertion_date: shift(0) });
  const pedroChat = await repos.chats.create({
    service_id: 1, farmer_id: farmerId, worker_id: pedro.id, farmer_shares_phone: false, worker_shares_phone: false,
    farmer_read_up_to: 0, worker_read_up_to: 0, closes_at: null, insertion_date: hours(20)
  });
  const pedroProposal = await repos.proposals.create({
    application_id: pedroApp.id, service_id: 1, farmer_id: farmerId, worker_id: pedro.id, amount: 180, unit: 'day', notes: null, proposed_by: 'worker', status: 'Pending', insertion_date: hours(4), answered_at: null
  });
  const negotiation: number[] = [];
  for (const [sender, body, hoursAgo, proposalId] of [
    ['system', OPENED_MESSAGE, 20, undefined],
    ['farmer', 'Oi, Pedro! A colheita é manual, em terreno inclinado. Topa?', 19, undefined],
    ['worker', 'Topo sim. Faço por dia, pago no fim de cada dia.', 5, undefined],
    ['system', `Pedro propôs ${describeTerms(pedroProposal)}.`, 4, pedroProposal.id]
  ] as const) {
    negotiation.push((await repos.chatMessages.create({
      chat_id: pedroChat.id, sender, body, ...(proposalId === undefined ? {} : { proposal_id: proposalId }), insertion_date: hours(hoursAgo)
    })).id);
  }
  await repos.chats.update({ ...pedroChat, farmer_read_up_to: negotiation[1] ?? 0, worker_read_up_to: negotiation.at(-1) ?? 0 });

  // Central de notificações: os avisos que essa história geraria (os textos são os mesmos dos casos de uso).
  const hoursAgo = hours;
  const notices = [
    // João (produtor)
    { role: 'farmer', profile_id: farmerId, title: 'Nova candidatura', body: 'Carlos Produtor e Trabalhador se candidatou a Colheita de café.', url: 'produtor/servicos/1', count: 2, read: false, insertion_date: hoursAgo(1) },
    { role: 'farmer', profile_id: farmerId, title: 'Nova proposta', body: `Pedro propôs ${describeTerms(pedroProposal)}. Responda na conversa.`, url: `produtor/conversas/${pedroChat.id}`, count: 1, read: false, insertion_date: hoursAgo(4) },
    { role: 'farmer', profile_id: farmerId, title: 'Sua fazenda foi avaliada', body: `O trabalhador avaliou ${ordenha.service.name}. Avalie o trabalho dele para ver a nota.`, url: `produtor/servicos/${ordenha.service.id}`, count: 1, read: false, insertion_date: shift(-2) },
    { role: 'farmer', profile_id: farmerId, title: 'Nova mensagem de Maria', body: 'Terminei o pasto de cima. Amanhã faço o de baixo.', url: `produtor/conversas/${pastoChat.id}`, count: 1, read: true, insertion_date: shift(-2) },
    // Maria (trabalhadora)
    { role: 'worker', profile_id: mariaId, title: 'Nova mensagem de João', body: 'Só luvas. O resto a fazenda fornece, e o almoço é por nossa conta.', url: `trabalhador/conversas/${curralChat.id}`, count: 1, read: false, insertion_date: hoursAgo(2) },
    { role: 'worker', profile_id: mariaId, title: 'Pagamento liberado', body: `Pagamento de ${money(320)} liberado em ${pasto.service.name}. Conte como foi na fazenda.`, url: `trabalhador/vagas/${pasto.service.id}`, count: 1, read: false, insertion_date: shift(-1) },
    { role: 'worker', profile_id: mariaId, title: 'Você foi aceito!', body: `O produtor aceitou sua candidatura em ${curral.name}.`, url: 'trabalhador/candidaturas', count: 1, read: true, insertion_date: shift(-5) }
  ] as const;
  for (const notice of notices) await repos.notifications.create(notice);

  // Duas denúncias em análise, para a fila de moderação da equipe (/sistema/moderacao).
  const report = { status: 'open', resolution_note: null, reviewed_at: null } as const;
  await repos.reports.create({
    ...report, reporter_role: 'worker', reporter_id: carlosWorkerId, target_type: 'service', target_id: 1, reason: 'condicoes',
    details: 'A vaga não diz se a fazenda fornece EPI para a colheita.', insertion_date: hoursAgo(5)
  });
  await repos.reports.create({
    ...report, reporter_role: 'farmer', reporter_id: farmerId, target_type: 'worker', target_id: pedro.id, reason: 'outro',
    details: 'Pediu para receber adiantado, por fora do app.', insertion_date: hoursAgo(3)
  });
}
