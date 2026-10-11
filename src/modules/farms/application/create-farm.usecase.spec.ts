import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import type { FarmInput } from '../farm.contract';
import { type FarmsTestbed, NOW, farmsTestbed, givenFarmer } from '../testing/farm-fixtures';
import { CreateFarmUseCase } from './create-farm.usecase';

const INPUT: FarmInput = { address: 'Estrada Velha, Km 3', city: 'Três Rios', state: 'RJ', latitude: -22.1165, longitude: -43.2092 };

describe('CreateFarmUseCase', () => {
  let t: FarmsTestbed;
  let createFarm: CreateFarmUseCase;

  beforeEach(() => {
    t = farmsTestbed();
    createFarm = new CreateFarmUseCase(t);
  });

  it('cadastra sem fotos, com a data do relógio, e acrescenta a farmer.farms', async () => {
    const farmer = await givenFarmer(t);

    const farm = unwrap(await createFarm.execute({ farmerId: farmer.id, input: INPUT }));

    assert.deepEqual(farm, { id: farm.id, farmer_id: farmer.id, ...INPUT, photos: [], insertion_date: NOW });
    assert.deepEqual(await t.farms.findById(farm.id), farm);
    assert.deepEqual((await t.farmers.findById(farmer.id))?.farms, [farm.id]);
  });

  it('produtor inexistente dá not_found e não cria nada', async () => {
    const result = await createFarm.execute({ farmerId: 99, input: INPUT });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
    assert.deepEqual(await t.farms.find(), []);
  });
});
