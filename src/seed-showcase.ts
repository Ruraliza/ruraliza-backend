// Exemplos em Goiás para mostrar o app na prática com as contas de teste, criados no fim do seed (os ids anteriores
// continuam os mesmos):
// - Carlos (ambos@exemplo.com) como produtor: o Sítio Boa Esperança, em Rio Verde, com uma cerca para consertar
//   (a Maria se candidatou e propôs um valor que ele ainda não respondeu), uma caixa d'água sem candidatos e uma roçada
//   já paga e avaliada pelos dois;
// - João (produtor@exemplo.com): a Fazenda Santa Luzia, também em Rio Verde, com uma vaga de construção de cerca;
// - prestadores do catálogo perto de Rio Verde, para as vagas de Goiás terem indicações;
// - Maria (trabalhador@exemplo.com): a trilha de trator concluída, com certificado validável.
import { OPENED_MESSAGE } from '#modules/chat';
import { windowEndsAt } from '#modules/reviews';
import { type PriceUnit, SERVICE_STATUS, type Service, describeTerms } from '#modules/services';
import { randomCertificateCodes, sha256CertificateHasher } from '#modules/tracks';
import type { Repositories } from './repositories';

const DAY_MS = 24 * 60 * 60 * 1000;
const RIO_VERDE = { latitude: -17.7923, longitude: -50.9192 };

export interface ShowcasePeople {
  joaoId: number;
  carlosFarmerId: number;
  mariaId: number;
}

export async function seedShowcase(repos: Repositories, now: string, people: ShowcasePeople): Promise<void> {
  const shift = (days: number): string => new Date(Date.parse(now) + days * DAY_MS).toISOString();
  const hours = (h: number): string => new Date(Date.parse(now) - h * 3_600_000).toISOString();
  const { joaoId, carlosFarmerId, mariaId } = people;

  // Prestadores do catálogo em Goiás (sem conta de acesso), como os de src/seed-catalog.ts.
  for (const p of [
    { name: 'Zé Arameiro', cpf: '45317828791', bio: 'Cerca de arame, mourão e esticador. Atendo a região de Rio Verde.', experience: '15 anos',
      categories: ['Conserto de cerca', 'Construção de cerca', 'Troca de mourões e esticadores'] },
    { name: 'Lourdes Encanadora', cpf: '86288366757', bio: 'Caixa d\'água, boia, cano e bomba.', experience: '9 anos',
      categories: ['Encanamento e caixa d\'água', 'Manutenção'] },
    { name: 'Tião Roçador', cpf: '27472893506', bio: 'Roçada manual e com trator, aceiro e limpeza de pasto.', experience: '7 anos',
      categories: ['Roçada manual', 'Limpeza de pasto', 'Aceiro manual', 'Operação de máquinas'] }
  ]) {
    const worker = await repos.workers.create({
      email: `${p.name.split(' ')[0]?.toLowerCase() ?? 'catalogo'}.goias@exemplo.com`, name: p.name, bio: p.bio, certificates: null, courses: null,
      experience: p.experience, photo_url: null, resume_url: null, phone: '64900000000', cpf: p.cpf, insertion_date: shift(-25)
    });
    await repos.jobPreferences.create({
      worker_id: worker.id, categories: p.categories, near: { ...RIO_VERDE, radius_km: 60 }, alerts: false, catalog: true, last_digest_at: null
    });
  }

  // Carlos vira produtor também: o primeiro sítio dele.
  const carlos = await repos.farmers.findById(carlosFarmerId);
  if (!carlos) throw new Error('seed: produtor Carlos não existe');
  const sitio = await repos.farms.create({
    farmer_id: carlosFarmerId, address: 'Estrada Municipal RV-12, Km 8', city: 'Rio Verde', state: 'GO',
    latitude: -17.8412, longitude: -50.8838, photos: [], insertion_date: shift(-20)
  });
  await repos.farmers.update({ ...carlos, farms: [...carlos.farms, sitio.id] });

  const open = (farmerId: number, farmId: number, name: string, category: string, description: string, duration: number,
    price: number, unit: PriceUnit, daysAgo: number, expiresInDays: number | null): Promise<Service> => repos.services.create({
    farmer_id: farmerId, farm_id: farmId, worker_id: null, payment_id: null, proposal_id: null, agreement: null, completed_at: null,
    price, price_unit: unit, name, description, category, duration,
    expires_at: expiresInDays === null ? null : shift(expiresInDays).slice(0, 10), status: SERVICE_STATUS.PENDING, insertion_date: shift(-daysAgo)
  });

  // A cerca caiu do lado da estrada: a Maria se candidatou e propôs R$ 150 por dia; o Carlos ainda não respondeu.
  const cerca = await open(carlosFarmerId, sitio.id, 'Conserto de cerca na beira da estrada', 'Conserto de cerca',
    'Uns 60 m de cerca caíram com a chuva, do lado da estrada. Precisa trocar 8 mourões e esticar o arame. Urgente: o gado está no pasto ao lado.',
    8, 150, 'day', 0.2, 2);
  const application = await repos.applications.create({
    invited: false, service_id: cerca.id, worker_id: mariaId, status: 'Pending',
    message: 'Já fiz muita cerca de arame. Consigo ir amanhã cedo.', insertion_date: hours(4)
  });
  const proposal = await repos.proposals.create({
    application_id: application.id, service_id: cerca.id, farmer_id: carlosFarmerId, worker_id: mariaId, amount: 150, unit: 'day',
    notes: 'Levo alicate e esticador.', proposed_by: 'worker', status: 'Pending', insertion_date: hours(1), answered_at: null
  });
  const chat = await repos.chats.create({
    service_id: cerca.id, farmer_id: carlosFarmerId, worker_id: mariaId, farmer_shares_phone: false, worker_shares_phone: false,
    farmer_read_up_to: 0, worker_read_up_to: 0, closes_at: null, insertion_date: hours(3.5)
  });
  const ids: number[] = [];
  for (const [sender, body, hoursAgo, proposalId] of [
    ['system', OPENED_MESSAGE, 3.5, undefined],
    ['farmer', 'Oi, Maria! A cerca é de 5 fios. Os mourões novos já estão no local.', 3, undefined],
    ['worker', 'Ótimo. Em um dia eu termino. O senhor tem arame sobrando?', 2, undefined],
    ['farmer', 'Tenho um rolo inteiro no galpão.', 1.5, undefined],
    ['system', `Maria propôs ${describeTerms(proposal)}.`, 1, proposal.id]
  ] as const) {
    ids.push((await repos.chatMessages.create({
      chat_id: chat.id, sender, body, ...(proposalId === undefined ? {} : { proposal_id: proposalId }), insertion_date: hours(hoursAgo)
    })).id);
  }
  await repos.chats.update({ ...chat, farmer_read_up_to: ids[3] ?? 0, worker_read_up_to: ids.at(-1) ?? 0 });

  await open(carlosFarmerId, sitio.id, 'Troca da boia da caixa d\'água', 'Encanamento e caixa d\'água',
    'A caixa de 1.000 litros do curral está transbordando. Trocar a boia e conferir o registro.', 3, 120, 'fixed', 1.3, 5);

  // Roçada já paga e avaliada pelos dois: o sítio do Carlos tem nota, e a Maria ganha mais uma avaliação.
  const doneAt = shift(-12);
  const agreedAt = shift(-16);
  const rocada = await repos.services.create({
    farmer_id: carlosFarmerId, farm_id: sitio.id, worker_id: mariaId, payment_id: null, proposal_id: null, agreement: null, completed_at: doneAt,
    name: 'Roçada do pasto da frente', description: 'Roçada manual de 2 hectares antes das chuvas.', category: 'Roçada manual',
    duration: 16, price: 130, price_unit: 'day', expires_at: null, status: SERVICE_STATUS.COMPLETED, insertion_date: shift(-17)
  });
  const rocadaApp = await repos.applications.create({ invited: false, service_id: rocada.id, worker_id: mariaId, status: 'Accepted', insertion_date: shift(-16.5) });
  const terms = { amount: 140, unit: 'day', notes: null } as const;
  const rocadaProposal = await repos.proposals.create({
    ...terms, application_id: rocadaApp.id, service_id: rocada.id, farmer_id: carlosFarmerId, worker_id: mariaId,
    proposed_by: 'worker', status: 'Accepted', insertion_date: shift(-16.2), answered_at: agreedAt
  });
  const payment = await repos.payments.create({
    service_id: rocada.id, farmer_id: carlosFarmerId, worker_id: mariaId, value: 280, status: 'Completed', insertion_date: doneAt
  });
  await repos.services.update({ ...rocada, payment_id: payment.id, proposal_id: rocadaProposal.id, agreement: { ...terms, agreed_at: agreedAt } });
  const reviewedAt = shift(-11);
  await repos.workerReviews.create({
    service_id: rocada.id, farmer_id: carlosFarmerId, worker_id: mariaId, punctuality: 5, effort: 5, quality: 4,
    comment: 'Rápida e caprichosa. Vou chamar de novo.', insertion_date: reviewedAt, window_ends_at: windowEndsAt(doneAt), revealed: true
  });
  await repos.farmReviews.create({
    service_id: rocada.id, farm_id: sitio.id, farmer_id: carlosFarmerId, worker_id: mariaId, infrastructure: 4, conditions: 5, as_described: 5,
    comment: 'Pagou certinho e deu água gelada o dia todo.', insertion_date: reviewedAt, window_ends_at: windowEndsAt(doneAt), revealed: true
  });

  await repos.notifications.create({
    role: 'farmer', profile_id: carlosFarmerId, title: 'Nova proposta', body: `Maria propôs ${describeTerms(proposal)}. Responda na conversa.`,
    url: `produtor/conversas/${chat.id}`, count: 1, read: false, insertion_date: hours(1)
  });
  await repos.notifications.create({
    role: 'farmer', profile_id: carlosFarmerId, title: 'Nova candidatura', body: `Maria Trabalhadora se candidatou a ${cerca.name}.`,
    url: `produtor/servicos/${cerca.id}`, count: 1, read: false, insertion_date: hours(4)
  });

  // João também tem fazenda em Goiás, com uma vaga que o catálogo de Rio Verde atende.
  const joao = await repos.farmers.findById(joaoId);
  if (!joao) throw new Error('seed: produtor João não existe');
  const santaLuzia = await repos.farms.create({
    farmer_id: joaoId, address: 'GO-174, Km 22', city: 'Rio Verde', state: 'GO',
    latitude: -17.7341, longitude: -50.9687, photos: [], insertion_date: shift(-15)
  });
  await repos.farmers.update({ ...joao, farms: [...joao.farms, santaLuzia.id] });
  await open(joaoId, santaLuzia.id, 'Construção de cerca do piquete', 'Construção de cerca',
    'Cerca nova de 300 m para dividir o piquete das novilhas. Material por conta da fazenda.', 24, 14, 'meter', 1.6, 10);

  // Maria concluiu a trilha de trator: certificado emitido há 10 dias.
  const [tractor] = (await repos.tracks.find()).filter((t) => t.title.startsWith('Trator'));
  const worker = await repos.workers.findById(mariaId);
  if (tractor && worker) {
    const lessons = tractor.modules.flatMap((m) => m.lessons);
    const completedAt = shift(-10);
    await repos.enrollments.create({
      track_id: tractor.id, worker_id: mariaId, completed_lesson_ids: lessons.map((l) => l.id), last_lesson_id: lessons.at(-1)?.id ?? null,
      started_at: shift(-14), completed_at: completedAt
    });
    const data = {
      code: randomCertificateCodes.create(), worker_name: worker.name, track_title: tractor.title,
      workload_minutes: lessons.reduce((sum, l) => sum + l.duration_minutes, 0), completed_at: completedAt
    };
    await repos.certificates.create({ ...data, track_id: tractor.id, worker_id: mariaId, issued_at: completedAt, data_hash: sha256CertificateHasher.hash(data) });
  }
}
