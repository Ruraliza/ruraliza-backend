import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type FarmsTestbed, NOW, farmsTestbed, givenFarm, givenFarmer } from '../testing/farm-fixtures';
import { ListFarmsUseCase } from './list-farms.usecase';

describe('ListFarmsUseCase', () => {
  let t: FarmsTestbed;
  let listFarms: ListFarmsUseCase;

  beforeEach(() => {
    t = farmsTestbed();
    listFarms = new ListFarmsUseCase(t);
  });

  it('lista só as fazendas ativas do produtor', async () => {
    const ana = await givenFarmer(t);
    const active = await givenFarm(t, ana);
    const archived = await givenFarm(t, ana);
    await t.farms.update({ ...archived, deleted_at: NOW });
    const bia = await givenFarmer(t, 'bia@exemplo.com', '11144477735');
    await givenFarm(t, bia);

    const farms = unwrap(await listFarms.execute({ farmerId: ana.id }));

    assert.deepEqual(farms.map((f) => f.id), [active.id]);
  });

  it('produtor inexistente dá not_found', async () => {
    const result = await listFarms.execute({ farmerId: 99 });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
