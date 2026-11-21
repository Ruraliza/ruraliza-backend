import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { createInMemoryAccountRepository } from '#modules/accounts';
import { createInMemoryFarmRepository } from '#modules/farms';
import { createInMemoryApplicationRepository, createInMemoryInviteRepository } from '#modules/hiring';
import { workerReputation } from '#modules/reviews';
import { NO_VERIFIED_FARMERS, type Service, createInMemoryServiceRepository } from '#modules/services';
import { createInMemoryEnrollmentRepository, createInMemoryTrackRepository } from '#modules/tracks';
import { createInMemoryWorkerRepository } from '#modules/workers';
import { type SentPush, adjustableClock, recordingPush } from '#shared/testing/recorders';
import { unwrap } from '#shared/testing/unwrap';
import { createInMemoryCatalogNoticeStore, createInMemoryJobAlertRepository, createInMemoryJobPreferencesRepository } from '../infra/in-memory-matching.repositories';
import { CATALOG_NOTICE, sendCatalogNotices } from './catalog-notices';
import { CATALOG_LIMIT, CatalogUseCase } from './catalog.usecase';
import type { MatchingDeps } from './matching-deps';
import { SaveJobPreferencesUseCase } from './save-job-preferences.usecase';

const NOW = '2026-10-16T12:00:00.000Z';
const TRES_RIOS = { latitude: -22.12, longitude: -43.21 };
const FARMER_ID = 1;

describe('Catálogo de prestadores', () => {
  let deps: MatchingDeps & { clock: ReturnType<typeof adjustableClock> };
  let catalog: CatalogUseCase;
  let save: SaveJobPreferencesUseCase;
  let service: Service;
  let verified: Set<number>;
  let pushes: SentPush[];

  const newWorker = async (name: string): Promise<number> => (await deps.workers.create({
    email: `${name.toLowerCase()}@exemplo.com`, name, phone: '24999990000', cpf: '11144477735', bio: 'Trabalho na roça.', certificates: 'NR-31',
    courses: null, experience: '5 anos', photo_url: null, resume_url: null, insertion_date: NOW
  })).id;
  const prefer = async (workerId: number, categories: string[], extra: { radius?: number; catalog?: boolean } = {}): Promise<void> => {
    const near = extra.radius === undefined ? null : { ...TRES_RIOS, radius_km: extra.radius };
    unwrap(await save.execute({ workerId, input: { categories, near, alerts: false, ...(extra.catalog === undefined ? {} : { catalog: extra.catalog }) } }));
  };
  const names = async (): Promise<string[]> => unwrap(await catalog.execute({ serviceId: service.id })).map((w) => w.name);

  beforeEach(async () => {
    const push = recordingPush();
    pushes = push.sent;
    verified = new Set();
    deps = {
      jobPreferences: createInMemoryJobPreferencesRepository(),
      jobAlerts: createInMemoryJobAlertRepository(),
      catalogNotices: createInMemoryCatalogNoticeStore(),
      services: createInMemoryServiceRepository(),
      farms: createInMemoryFarmRepository(),
      applications: createInMemoryApplicationRepository(),
      invites: createInMemoryInviteRepository(),
      tracks: createInMemoryTrackRepository(),
      enrollments: createInMemoryEnrollmentRepository(),
      workers: createInMemoryWorkerRepository(),
      accounts: createInMemoryAccountRepository(),
      reputation: { forFarms: () => Promise.resolve(new Map()) },
      verification: NO_VERIFIED_FARMERS,
      workerReputation: { forWorkers: (ids) => Promise.resolve(new Map(ids.map((id) => [id, workerReputation([])]))) },
      workerVerification: { verifiedWorkers: (ids) => Promise.resolve(new Set(ids.filter((id) => verified.has(id)))) },
      clock: adjustableClock(NOW),
      push
    };
    const farm = await deps.farms.create({
      farmer_id: FARMER_ID, address: 'Sítio', city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092, photos: [], insertion_date: NOW
    });
    service = await deps.services.create({
      farmer_id: FARMER_ID, farm_id: farm.id, payment_id: null, proposal_id: null, agreement: null, completed_at: null, price: 150, price_unit: 'day',
      worker_id: null, name: 'Colheita de café', description: null, category: 'Colheita', duration: 8, expires_at: '2026-10-20', status: 'Pending', insertion_date: NOW
    });
    catalog = new CatalogUseCase(deps);
    save = new SaveJobPreferencesUseCase(deps);
  });

  it('mostra quem escolheu a categoria com o catálogo ligado (o padrão), com motivos e sem contato nem localização', async () => {
    const maria = await newWorker('Maria');
    await prefer(maria, ['Colheita', 'Plantio'], { radius: 30 });
    verified.add(maria);
    await prefer(await newWorker('Joao'), ['Plantio']); // outra categoria
    await newWorker('Sem'); // sem preferências: catálogo ligado, mas nenhuma categoria

    const [first, ...others] = unwrap(await catalog.execute({ serviceId: service.id }));

    assert.deepEqual(others, []);
    assert.deepEqual(first, {
      id: maria, name: 'Maria', photo_url: null, bio: 'Trabalho na roça.', experience: '5 anos', certificates: 'NR-31',
      reputation: workerReputation([]), verified: true, reasons: ['Escolheu Colheita', 'Até 5 km da fazenda', 'Verificado']
    });
    for (const field of ['cpf', 'phone', 'email', 'latitude', 'longitude', 'near', 'distance_km']) assert.equal(Object.keys(first).includes(field), false, field);
  });

  it('quem desliga sai na hora; fora do raio não entra; a ordem segue os sinais', async () => {
    const near = await newWorker('Perto');
    const nearer = await newWorker('Pertinho');
    const off = await newWorker('Desligado');
    const far = await newWorker('Longe');
    await prefer(near, ['Colheita'], { radius: 300 });
    await prefer(nearer, ['Colheita'], { radius: 30 });
    await prefer(off, ['Colheita']);
    await prefer(far, ['Colheita'], { radius: 5 });
    // A fazenda fica a ~0 km de Três Rios; "Longe" marcou um ponto a ~40 km com raio de 5 km.
    const farPrefs = (await deps.jobPreferences.find({ worker_id: far }))[0];
    if (!farPrefs) throw new Error('cenário');
    await deps.jobPreferences.update({ ...farPrefs, near: { latitude: -22.48, longitude: -43.2, radius_km: 5 } });

    assert.deepEqual(await names(), ['Perto', 'Pertinho', 'Desligado']); // com distância pesa mais (pela faixa); empate: o cadastro mais antigo
    await prefer(off, ['Colheita'], { catalog: false });
    assert.deepEqual(await names(), ['Perto', 'Pertinho']);
    assert.equal(await catalog.listed(service, off), false);
    assert.equal(await catalog.listed(service, near), true);
  });

  it('exclui o próprio produtor e quem já se candidatou, foi recusado ou convidado', async () => {
    const own = await newWorker('Eu');
    const applied = await newWorker('Candidato');
    const rejected = await newWorker('Recusado');
    const invited = await newWorker('Convidado');
    const free = await newWorker('Livre');
    for (const id of [own, applied, rejected, invited, free]) await prefer(id, ['Colheita']);
    await deps.accounts.create({
      email: 'eu@exemplo.com', password_hash: 'x', reset_token_digest: null, reset_expires_at: null, farmer_id: FARMER_ID, worker_id: own, last_role: 'farmer'
    });
    await deps.applications.create({ invited: false, service_id: service.id, worker_id: applied, status: 'Pending', insertion_date: NOW });
    await deps.applications.create({ invited: false, service_id: service.id, worker_id: rejected, status: 'Rejected', insertion_date: NOW });
    await deps.invites.create({ service_id: service.id, farmer_id: FARMER_ID, worker_id: invited, status: 'Declined', insertion_date: NOW, answered_at: NOW });

    assert.deepEqual(await names(), ['Livre']);
  });

  it(`no máximo ${CATALOG_LIMIT}; vaga fechada ou vencida dá 409`, async () => {
    for (let i = 0; i < CATALOG_LIMIT + 2; i++) await prefer(await newWorker(`W${i}`), ['Colheita']);
    assert.equal((await names()).length, CATALOG_LIMIT);

    deps.clock.set('2026-10-22T12:00:00.000Z');
    assert.equal((await catalog.execute({ serviceId: service.id })).ok, false);
    deps.clock.set(NOW);
    await deps.services.update({ ...service, status: 'In Progress' });
    const closed = await catalog.execute({ serviceId: service.id });
    assert.equal(closed.ok ? '' : closed.message, 'O catálogo só fica disponível enquanto a vaga está aberta.');
  });

  it('o aviso único sai uma vez só para as contas de antes do catálogo', async () => {
    const old = await newWorker('Antiga');
    deps.catalogNotices = createInMemoryCatalogNoticeStore([old, 999]); // 999: conta já removida

    assert.equal(await sendCatalogNotices(deps), 1);
    assert.equal(await sendCatalogNotices(deps), 0);
    assert.deepEqual(pushes, [{ role: 'worker', profileId: old, message: CATALOG_NOTICE }]);
  });
});
