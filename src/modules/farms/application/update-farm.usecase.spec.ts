import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type FarmsTestbed, NOW, farmsTestbed, givenFarm, givenFarmer } from '../testing/farm-fixtures';
import { UpdateFarmUseCase } from './update-farm.usecase';

describe('UpdateFarmUseCase', () => {
  let t: FarmsTestbed;
  let updateFarm: UpdateFarmUseCase;

  beforeEach(() => {
    t = farmsTestbed();
    updateFarm = new UpdateFarmUseCase(t);
  });

  it('editar o ponto no mapa troca latitude e longitude e mantém o resto', async () => {
    const farmer = await givenFarmer(t);
    const { id: farmId } = await givenFarm(t, farmer);

    const farm = unwrap(await updateFarm.execute({ farmerId: farmer.id, farmId, changes: { latitude: -22.2, longitude: -43.3 } }));

    assert.deepEqual([farm.latitude, farm.longitude], [-22.2, -43.3]);
    assert.equal(farm.address, 'Sítio');
    assert.deepEqual(await t.farms.findById(farmId), farm);
  });

  it('só os campos enviados mudam', async () => {
    const farmer = await givenFarmer(t);
    const before = await givenFarm(t, farmer);

    const farm = unwrap(await updateFarm.execute({ farmerId: farmer.id, farmId: before.id, changes: { city: 'Paty do Alferes' } }));

    assert.deepEqual(farm, { ...before, city: 'Paty do Alferes' });
  });

  it('fazenda de outro produtor ou arquivada dá not_found sem alterar nada', async () => {
    const ana = await givenFarmer(t);
    const farm = await givenFarm(t, ana);
    const bia = await givenFarmer(t, 'bia@exemplo.com', '11144477735');

    const fromOther = await updateFarm.execute({ farmerId: bia.id, farmId: farm.id, changes: { city: 'Outra' } });
    assert.equal(fromOther.ok ? 'ok' : fromOther.kind, 'not_found');

    await t.farms.update({ ...farm, deleted_at: NOW });
    const archived = await updateFarm.execute({ farmerId: ana.id, farmId: farm.id, changes: { city: 'Outra' } });
    assert.equal(archived.ok ? 'ok' : archived.kind, 'not_found');

    assert.equal((await t.farms.findById(farm.id))?.city, 'Três Rios');
  });
});
