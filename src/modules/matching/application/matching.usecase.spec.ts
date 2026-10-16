import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { type Account, createInMemoryAccountRepository } from '#modules/accounts';
import { createInMemoryFarmRepository } from '#modules/farms';
import { createInMemoryApplicationRepository } from '#modules/hiring';
import { NO_VERIFIED_FARMERS, type Service, createInMemoryServiceRepository } from '#modules/services';
import { createInMemoryEnrollmentRepository, createInMemoryTrackRepository } from '#modules/tracks';
import { createInMemoryWorkerRepository } from '#modules/workers';
import { type SentPush, adjustableClock, recordingPush } from '#shared/testing/recorders';
import { unwrap } from '#shared/testing/unwrap';
import { createInMemoryJobAlertRepository, createInMemoryJobPreferencesRepository } from '../infra/in-memory-matching.repositories';
import { GetJobPreferencesUseCase } from './get-job-preferences.usecase';
import { JobAlerts } from './job-alerts';
import type { MatchingDeps } from './matching-deps';
import { RecommendJobsUseCase } from './recommend-jobs.usecase';
import { SaveJobPreferencesUseCase } from './save-job-preferences.usecase';

const NOW = '2026-10-16T12:00:00.000Z';
const NEAR_TRES_RIOS = { latitude: -22.1234, longitude: -43.2156, radius_km: 30 };

describe('Vagas para você', () => {
  let deps: MatchingDeps & { clock: ReturnType<typeof adjustableClock> };
  let pushes: SentPush[];
  let save: SaveJobPreferencesUseCase;
  let recommend: RecommendJobsUseCase;
  let alerts: JobAlerts;
  let farmTresRios: number;
  let farmFar: number;

  const publish = (name: string, category: string, farmId = farmTresRios, changes: Partial<Service> = {}): Promise<Service> =>
    deps.services.create({
      farmer_id: 1, farm_id: farmId, payment_id: null, worker_id: null, name, description: null, category,
      duration: 8, price: 1800, expires_at: null, status: 'Pending', insertion_date: deps.clock.now(), ...changes
    });

  beforeEach(async () => {
    const push = recordingPush();
    pushes = push.sent;
    deps = {
      jobPreferences: createInMemoryJobPreferencesRepository(),
      jobAlerts: createInMemoryJobAlertRepository(),
      services: createInMemoryServiceRepository(),
      farms: createInMemoryFarmRepository(),
      applications: createInMemoryApplicationRepository(),
      tracks: createInMemoryTrackRepository(),
      enrollments: createInMemoryEnrollmentRepository(),
      workers: createInMemoryWorkerRepository(),
      accounts: createInMemoryAccountRepository(),
      reputation: { forFarms: () => Promise.resolve(new Map()) },
      verification: NO_VERIFIED_FARMERS,
      clock: adjustableClock(NOW),
      push
    };
    const farm = { farmer_id: 1, address: 'Sítio', photos: [], insertion_date: NOW };
    farmTresRios = (await deps.farms.create({ ...farm, city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092 })).id;
    farmFar = (await deps.farms.create({ ...farm, city: 'Petrópolis', state: 'RJ', latitude: -22.505, longitude: -43.1789 })).id;
    const worker = { phone: '1', bio: null, certificates: null, courses: null, experience: null, photo_url: null, resume_url: null, insertion_date: NOW };
    await deps.workers.create({ ...worker, email: 'maria@exemplo.com', name: 'Maria', cpf: '11144477735' });
    await deps.workers.create({ ...worker, email: 'joao@exemplo.com', name: 'João', cpf: '52998224725' });
    const account: Omit<Account, 'id'> = {
      email: 'maria@exemplo.com', password_hash: 'x', reset_token_digest: null, reset_expires_at: null, farmer_id: null, worker_id: 1, last_role: 'worker'
    };
    await deps.accounts.create(account);
    save = new SaveJobPreferencesUseCase(deps);
    recommend = new RecommendJobsUseCase(deps);
    alerts = new JobAlerts(deps, recommend);
  });

  it('sem nada salvo, as preferências vêm vazias; a região é guardada aproximada', async () => {
    const get = new GetJobPreferencesUseCase(deps);
    assert.deepEqual(unwrap(await get.execute({ workerId: 1 })), { categories: [], near: null, alerts: false });

    const saved = unwrap(await save.execute({ workerId: 1, input: { categories: ['Colheita', 'Colheita'], near: NEAR_TRES_RIOS, alerts: false } }));

    assert.deepEqual(saved, { categories: ['Colheita'], near: { latitude: -22.12, longitude: -43.22, radius_km: 30 }, alerts: false });
  });

  it('recomenda o que combina, a mais forte primeiro, sem as vagas em que já se candidatou', async () => {
    unwrap(await save.execute({ workerId: 1, input: { categories: ['Colheita', 'Plantio'], near: null, alerts: false } }));
    const plantio = await publish('Plantio de milho', 'Plantio');
    const colheita = await publish('Colheita de café', 'Colheita');
    await publish('Conserto de cerca', 'Manutenção');
    const applied = await publish('Colheita de laranja', 'Colheita');
    await deps.applications.create({ service_id: applied.id, worker_id: 1, status: 'Pending', insertion_date: NOW });
    const track = await deps.tracks.create({
      title: 'Colheita do café', description: 'x', categories: ['Colheita'], tutor_ids: [1], status: 'published', modules: [], last_item_id: 0, created_by: 1,
      insertion_date: NOW, updated_at: NOW, published_at: NOW
    });
    await deps.enrollments.create({ track_id: track.id, worker_id: 1, completed_lesson_ids: [], last_lesson_id: null, started_at: NOW, completed_at: NOW });

    const jobs = unwrap(await recommend.execute({ workerId: 1 }));

    assert.deepEqual(jobs.map((j) => [j.id, j.reasons]), [
      [colheita.id, ['Você escolheu Colheita', 'Você concluiu a trilha Colheita do café']],
      [plantio.id, ['Você escolheu Plantio']]
    ]);
    assert.equal(jobs[0]?.farm.latitude, undefined); // o ponto da fazenda não sai
  });

  it('perto de mim deixa de fora o que passa do raio e mostra a distância', async () => {
    unwrap(await save.execute({ workerId: 1, input: { categories: [], near: NEAR_TRES_RIOS, alerts: false } }));
    const close = await publish('Colheita de café', 'Colheita');
    await publish('Colheita em Petrópolis', 'Colheita', farmFar);

    const jobs = unwrap(await recommend.execute({ workerId: 1 }));

    assert.deepEqual(jobs.map((j) => [j.id, j.distance_km]), [[close.id, 1]]);
  });

  it('avisa na hora quem ligou os avisos e combina, no máximo 3 por dia e nunca a mesma vaga duas vezes', async () => {
    unwrap(await save.execute({ workerId: 1, input: { categories: ['Colheita'], near: NEAR_TRES_RIOS, alerts: true } }));
    unwrap(await save.execute({ workerId: 2, input: { categories: ['Plantio'], near: null, alerts: true } }));

    const first = await publish('Colheita de café', 'Colheita');
    await alerts.notifyNewJob(first);
    await alerts.notifyNewJob(first);
    for (const name of ['Colheita 2', 'Colheita 3', 'Colheita 4']) await alerts.notifyNewJob(await publish(name, 'Colheita'));
    await alerts.notifyNewJob(await publish('Colheita longe', 'Colheita', farmFar));

    assert.deepEqual(pushes.map((p) => [p.profileId, p.message.title]), [
      [1, 'Vaga nova perto de você'], [1, 'Vaga nova perto de você'], [1, 'Vaga nova perto de você']
    ]);
    assert.deepEqual(pushes[0]?.message, {
      title: 'Vaga nova perto de você', body: 'Colheita de café em Três Rios, RJ (a 1 km): 8 horas por R$ 1.800.', url: `trabalhador/vagas/${first.id}`
    });
  });

  it('o resumo semanal sai uma vez a cada 7 dias, só com vaga recomendada', async () => {
    unwrap(await save.execute({ workerId: 1, input: { categories: ['Colheita'], near: null, alerts: true } }));
    await publish('Colheita de café', 'Colheita');
    await publish('Colheita de laranja', 'Colheita');

    assert.equal(await alerts.sendWeeklyDigest(), 0); // acabou de ligar os avisos
    deps.clock.set('2026-10-23T12:00:00.000Z');
    assert.equal(await alerts.sendWeeklyDigest(), 1);
    assert.equal(await alerts.sendWeeklyDigest(), 0);

    assert.deepEqual(pushes.at(-1)?.message, {
      title: 'Encontramos 2 vagas para você', body: 'Colheita de laranja em Três Rios e mais 1. Veja as vagas recomendadas.', url: 'trabalhador'
    });
  });
});
