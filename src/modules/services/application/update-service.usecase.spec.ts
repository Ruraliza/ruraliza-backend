import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type ServicesTestbed, givenApplication, givenFarm, givenFarmer, givenService, servicesTestbed } from '../testing/service-fixtures';
import { UpdateServiceUseCase } from './update-service.usecase';

describe('UpdateServiceUseCase', () => {
  let t: ServicesTestbed;
  let update: UpdateServiceUseCase;

  beforeEach(() => {
    t = servicesTestbed();
    update = new UpdateServiceUseCase(t);
  });

  it('só os campos enviados mudam, e avisa a tela do serviço e a dos candidatos', async () => {
    const farm = await givenFarm(t, await givenFarmer(t));
    const before = await givenService(t, farm);
    await givenApplication(t, before, 7);

    const service = unwrap(await update.execute({ serviceId: before.id, changes: { price: 250, description: 'Levar enxada' } }));

    assert.deepEqual(service, { ...before, price: 250, description: 'Levar enxada' });
    assert.deepEqual(await t.services.findById(before.id), service);
    assert.deepEqual(t.published, [[`service:${before.id}:applications`, 'worker:7:applications']]);
  });

  it('troca para outra fazenda ativa do mesmo produtor; de outro produtor dá invalid', async () => {
    const ana = await givenFarmer(t);
    const service = await givenService(t, await givenFarm(t, ana));
    const second = await givenFarm(t, ana, { city: 'Paty do Alferes' });
    const biaFarm = await givenFarm(t, await givenFarmer(t, 'bia@exemplo.com', '11144477735'));

    const moved = unwrap(await update.execute({ serviceId: service.id, changes: { farm_id: second.id } }));
    assert.equal(moved.farm_id, second.id);

    const other = await update.execute({ serviceId: service.id, changes: { farm_id: biaFarm.id } });
    assert.equal(other.ok ? 'ok' : other.kind, 'invalid');
  });

  it('validade no passado dá invalid; nova validade renova a vaga vencida', async () => {
    const service = await givenService(t, await givenFarm(t, await givenFarmer(t)), { expires_at: '2026-09-20' });

    const past = await update.execute({ serviceId: service.id, changes: { expires_at: '2026-09-29' } });
    assert.equal(past.ok ? 'ok' : past.kind, 'invalid');

    const renewed = unwrap(await update.execute({ serviceId: service.id, changes: { expires_at: '2026-10-10' } }));
    assert.equal(renewed.expires_at, '2026-10-10');
  });

  for (const status of ['In Progress', 'Completed', 'Cancelled'] as const) {
    it(`serviço ${status} não pode ser editado`, async () => {
      const service = await givenService(t, await givenFarm(t, await givenFarmer(t)), { status });

      const result = await update.execute({ serviceId: service.id, changes: { price: 999 } });

      assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
      assert.equal((await t.services.findById(service.id))?.price, 200);
    });
  }

  it('serviço inexistente dá not_found', async () => {
    const result = await update.execute({ serviceId: 99, changes: { price: 1 } });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
