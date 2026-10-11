import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type ServicesTestbed, givenApplication, givenFarm, givenFarmer, givenService, servicesTestbed } from '../testing/service-fixtures';
import { CancelServiceUseCase } from './cancel-service.usecase';

describe('CancelServiceUseCase', () => {
  let t: ServicesTestbed;
  let cancel: CancelServiceUseCase;

  beforeEach(() => {
    t = servicesTestbed();
    cancel = new CancelServiceUseCase(t);
  });

  it('cancela, recusa as candidaturas pendentes e avisa cada candidato por push', async () => {
    const service = await givenService(t, await givenFarm(t, await givenFarmer(t)));
    const pending = await givenApplication(t, service, 7);
    const rejected = await givenApplication(t, service, 8, 'Rejected');

    const cancelled = unwrap(await cancel.execute({ serviceId: service.id }));

    assert.equal(cancelled.status, 'Cancelled');
    assert.equal((await t.services.findById(service.id))?.status, 'Cancelled');
    assert.equal((await t.applications.findById(pending.id))?.status, 'Rejected');
    assert.equal((await t.applications.findById(rejected.id))?.status, 'Rejected');
    assert.deepEqual(t.pushes, [{
      role: 'worker', profileId: 7,
      message: { title: 'Serviço cancelado', body: 'O produtor cancelou Capina.', url: 'trabalhador/candidaturas' }
    }]);
    assert.deepEqual(t.published, [[`service:${service.id}:applications`, 'worker:7:applications', 'worker:8:applications']]);
  });

  for (const status of ['In Progress', 'Completed', 'Cancelled'] as const) {
    it(`serviço ${status} não pode ser cancelado`, async () => {
      const service = await givenService(t, await givenFarm(t, await givenFarmer(t)), { status });

      const result = await cancel.execute({ serviceId: service.id });

      assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
      assert.equal((await t.services.findById(service.id))?.status, status);
      assert.deepEqual(t.pushes, []);
    });
  }

  it('serviço inexistente dá not_found', async () => {
    const result = await cancel.execute({ serviceId: 99 });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
