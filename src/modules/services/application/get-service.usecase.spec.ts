import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { NOW, type ServicesTestbed, givenFarm, givenFarmer, givenService, servicesTestbed } from '../testing/service-fixtures';
import { GetServiceUseCase } from './get-service.usecase';

describe('GetServiceUseCase', () => {
  let t: ServicesTestbed;
  let get: GetServiceUseCase;

  beforeEach(() => {
    t = servicesTestbed();
    get = new GetServiceUseCase(t);
  });

  it('traz a fazenda completa, mesmo arquivada', async () => {
    const farm = await givenFarm(t, await givenFarmer(t));
    const service = await givenService(t, farm, { status: 'Completed' });
    await t.farms.update({ ...farm, deleted_at: NOW });

    const found = unwrap(await get.execute({ serviceId: service.id }));

    assert.deepEqual(found, { ...service, farm: { ...farm, deleted_at: NOW } });
  });

  it('serviço inexistente dá not_found', async () => {
    const result = await get.execute({ serviceId: 99 });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
