import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { InMemoryChangeFeed } from '#shared/infra/memory/in-memory-change-feed';
import { unwrap } from '#shared/testing/unwrap';
import { NOW, type WorkersTestbed, givenFarm, givenService, givenWorker, workersTestbed } from '../testing/worker-fixtures';
import { ListWorkerApplicationsUseCase } from './list-worker-applications.usecase';
import { ListWorkerServicesUseCase } from './list-worker-services.usecase';
import { WatchWorkerApplicationsUseCase } from './watch-worker-applications.usecase';

describe('acompanhamento do trabalhador', () => {
  let t: WorkersTestbed;

  beforeEach(() => {
    t = workersTestbed();
  });

  it('candidaturas trazem a vaga, com o ponto no mapa só onde ele foi aceito', async () => {
    const worker = await givenWorker(t);
    const farm = await givenFarm(t);
    const open = await givenService(t, farm);
    const taken = await givenService(t, farm, { status: 'In Progress', worker_id: worker.id });
    await t.applications.create({ service_id: open.id, worker_id: worker.id, status: 'Pending', insertion_date: NOW });
    await t.applications.create({ service_id: taken.id, worker_id: worker.id, status: 'Accepted', insertion_date: NOW });

    const items = unwrap(await new ListWorkerApplicationsUseCase(t).execute({ workerId: worker.id }));

    assert.deepEqual(items.map((a) => [a.service.id, a.service.farm.latitude]), [[open.id, undefined], [taken.id, -22.1]]);
  });

  it('serviços aceitos: só os atribuídos a ele', async () => {
    const worker = await givenWorker(t);
    const farm = await givenFarm(t);
    await givenService(t, farm);
    const done = await givenService(t, farm, { status: 'Completed', worker_id: worker.id });

    const services = unwrap(await new ListWorkerServicesUseCase(t).execute({ workerId: worker.id }));

    assert.deepEqual(services.map((s) => s.id), [done.id]);
  });

  it('acompanhar avisa a cada mudança nas candidaturas dele até parar', async () => {
    const changes = new InMemoryChangeFeed();
    const worker = await givenWorker(t);
    let calls = 0;

    const stop = unwrap(await new WatchWorkerApplicationsUseCase({ ...t, changes }).execute({ workerId: worker.id, listener: () => { calls++; } }));
    changes.publish([`worker:${worker.id}:applications`, 'worker:99:applications']);
    stop();
    changes.publish([`worker:${worker.id}:applications`]);

    assert.equal(calls, 1);
  });

  it('trabalhador inexistente dá not_found', async () => {
    for (const result of [
      await new ListWorkerApplicationsUseCase(t).execute({ workerId: 99 }),
      await new ListWorkerServicesUseCase(t).execute({ workerId: 99 }),
      await new WatchWorkerApplicationsUseCase(t).execute({ workerId: 99, listener: () => undefined })
    ]) {
      assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
    }
  });
});
