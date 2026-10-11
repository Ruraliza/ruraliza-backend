import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type ServicesTestbed, givenApplication, givenFarm, givenFarmer, givenService, servicesTestbed } from '../testing/service-fixtures';
import { ListFarmerServicesUseCase } from './list-farmer-services.usecase';

describe('ListFarmerServicesUseCase', () => {
  let t: ServicesTestbed;
  let list: ListFarmerServicesUseCase;

  beforeEach(() => {
    t = servicesTestbed();
    list = new ListFarmerServicesUseCase(t);
  });

  it('lista os serviços do produtor com a fazenda e só as candidaturas pendentes contadas', async () => {
    const ana = await givenFarmer(t);
    const farm = await givenFarm(t, ana);
    const open = await givenService(t, farm);
    await givenApplication(t, open, 7);
    await givenApplication(t, open, 8);
    await givenApplication(t, open, 9, 'Rejected');
    const done = await givenService(t, farm, { status: 'Completed' });
    await givenService(t, await givenFarm(t, await givenFarmer(t, 'bia@exemplo.com', '11144477735')));

    const items = unwrap(await list.execute({ farmerId: ana.id }));

    assert.deepEqual(items.map((s) => [s.id, s.farm.id, s.applications_pending]), [[open.id, farm.id, 2], [done.id, farm.id, 0]]);
  });

  it('filtra por status', async () => {
    const ana = await givenFarmer(t);
    const farm = await givenFarm(t, ana);
    await givenService(t, farm);
    const done = await givenService(t, farm, { status: 'Completed' });

    const items = unwrap(await list.execute({ farmerId: ana.id, status: 'Completed' }));

    assert.deepEqual(items.map((s) => s.id), [done.id]);
  });

  it('produtor inexistente dá not_found', async () => {
    const result = await list.execute({ farmerId: 99 });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
