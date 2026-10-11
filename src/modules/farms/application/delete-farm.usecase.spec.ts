import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type FarmsTestbed, NOW, farmsTestbed, givenFarm, givenFarmer, givenService } from '../testing/farm-fixtures';
import { DeleteFarmUseCase } from './delete-farm.usecase';

describe('DeleteFarmUseCase', () => {
  let t: FarmsTestbed;
  let deleteFarm: DeleteFarmUseCase;

  beforeEach(() => {
    t = farmsTestbed();
    deleteFarm = new DeleteFarmUseCase(t);
  });

  it('arquiva a fazenda (deleted_at) e tira o id de farmer.farms', async () => {
    const farmer = await givenFarmer(t);
    const farm = await givenFarm(t, farmer);

    unwrap(await deleteFarm.execute({ farmerId: farmer.id, farmId: farm.id }));

    assert.equal((await t.farms.findById(farm.id))?.deleted_at, NOW);
    assert.deepEqual((await t.farmers.findById(farmer.id))?.farms, []);
  });

  for (const status of ['Pending', 'In Progress'] as const) {
    it(`serviço ${status} bloqueia a remoção sem alterar nada`, async () => {
      const farmer = await givenFarmer(t);
      const farm = await givenFarm(t, farmer);
      await givenService(t, farm, status);

      const result = await deleteFarm.execute({ farmerId: farmer.id, farmId: farm.id });

      assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
      assert.equal((await t.farms.findById(farm.id))?.deleted_at, undefined);
      assert.deepEqual((await t.farmers.findById(farmer.id))?.farms, [farm.id]);
    });
  }

  for (const status of ['Completed', 'Cancelled'] as const) {
    it(`serviço ${status} não bloqueia`, async () => {
      const farmer = await givenFarmer(t);
      const farm = await givenFarm(t, farmer);
      await givenService(t, farm, status);

      unwrap(await deleteFarm.execute({ farmerId: farmer.id, farmId: farm.id }));
    });
  }

  it('fazenda de outro produtor ou já removida dá not_found', async () => {
    const ana = await givenFarmer(t);
    const farm = await givenFarm(t, ana);
    const bia = await givenFarmer(t, 'bia@exemplo.com', '11144477735');

    const fromOther = await deleteFarm.execute({ farmerId: bia.id, farmId: farm.id });
    assert.equal(fromOther.ok ? 'ok' : fromOther.kind, 'not_found');

    unwrap(await deleteFarm.execute({ farmerId: ana.id, farmId: farm.id }));
    const again = await deleteFarm.execute({ farmerId: ana.id, farmId: farm.id });
    assert.equal(again.ok ? 'ok' : again.kind, 'not_found');
  });
});
