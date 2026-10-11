import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type HiringTestbed, givenApplication, givenService, givenWorker, hiringTestbed, statusesOf } from '../testing/hiring-fixtures';
import { AnalyzeApplicationUseCase } from './analyze-application.usecase';

describe('AnalyzeApplicationUseCase', () => {
  let t: HiringTestbed;
  let analyze: AnalyzeApplicationUseCase;

  beforeEach(() => {
    t = hiringTestbed();
    analyze = new AnalyzeApplicationUseCase(t);
  });

  it('recusar muda só a candidatura e avisa o trabalhador', async () => {
    const service = await givenService(t);
    const maria = await givenWorker(t);
    const application = await givenApplication(t, service, maria);

    const outcome = unwrap(await analyze.execute({ serviceId: service.id, application_id: application.id, action: 'Reject' }));

    assert.equal(outcome.application.status, 'Rejected');
    assert.equal(outcome.service, undefined);
    assert.equal((await t.services.findById(service.id))?.status, 'Pending');
    assert.deepEqual(t.pushes.map((p) => [p.profileId, p.message.title]), [[maria.id, 'Candidatura recusada']]);
  });

  it('aceitar põe o serviço em andamento e recusa as outras pendentes (auto_rejected)', async () => {
    const service = await givenService(t);
    const [maria, joao, ana] = [await givenWorker(t), await givenWorker(t, 'Joao'), await givenWorker(t, 'Ana')];
    const accepted = await givenApplication(t, service, maria);
    await givenApplication(t, service, joao);
    await givenApplication(t, service, ana, 'Rejected');

    const outcome = unwrap(await analyze.execute({ serviceId: service.id, application_id: accepted.id, action: 'Accept' }));

    assert.deepEqual([outcome.service?.status, outcome.service?.worker_id], ['In Progress', maria.id]);
    assert.deepEqual(await statusesOf(t, service), [[maria.id, 'Accepted', undefined], [joao.id, 'Rejected', true], [ana.id, 'Rejected', undefined]]);
    assert.deepEqual(t.pushes.map((p) => [p.profileId, p.message.title]), [[maria.id, 'Você foi aceito!'], [joao.id, 'Candidatura recusada']]);
    assert.deepEqual(t.published, [[`service:${service.id}:applications`, `worker:${maria.id}:applications`, `worker:${joao.id}:applications`]]);
  });

  it('candidatura de outro serviço dá invalid; já analisada ou serviço fechado dá conflict', async () => {
    const service = await givenService(t);
    const other = await givenService(t);
    const maria = await givenWorker(t);
    const elsewhere = await givenApplication(t, other, maria);
    const done = await givenApplication(t, service, maria, 'Rejected');
    const closed = await givenService(t, { status: 'Cancelled' });
    const onClosed = await givenApplication(t, closed, maria);

    const wrong = await analyze.execute({ serviceId: service.id, application_id: elsewhere.id, action: 'Accept' });
    assert.equal(wrong.ok ? 'ok' : wrong.kind, 'invalid');
    const twice = await analyze.execute({ serviceId: service.id, application_id: done.id, action: 'Accept' });
    assert.equal(twice.ok ? 'ok' : twice.kind, 'conflict');
    const notOpen = await analyze.execute({ serviceId: closed.id, application_id: onClosed.id, action: 'Accept' });
    assert.equal(notOpen.ok ? 'ok' : notOpen.kind, 'conflict');
  });

  it('serviço ou candidatura inexistente dá not_found', async () => {
    const service = await givenService(t);

    const noService = await analyze.execute({ serviceId: 99, application_id: 1, action: 'Accept' });
    assert.equal(noService.ok ? 'ok' : noService.kind, 'not_found');
    const noApplication = await analyze.execute({ serviceId: service.id, application_id: 99, action: 'Accept' });
    assert.equal(noApplication.ok ? 'ok' : noApplication.kind, 'not_found');
  });
});
