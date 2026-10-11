import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type FarmersTestbed, NOW, farmersTestbed, givenFarm, givenFarmer } from '../testing/farmer-fixtures';
import { DeleteFarmerUseCase } from './delete-farmer.usecase';

describe('DeleteFarmerUseCase', () => {
  let t: FarmersTestbed;
  let remove: DeleteFarmerUseCase;

  beforeEach(() => {
    t = farmersTestbed();
    remove = new DeleteFarmerUseCase(t);
  });

  async function serviceOf(farmerId: number, farmId: number, status: 'Pending' | 'In Progress' | 'Completed'): Promise<number> {
    const s = await t.services.create({
      farmer_id: farmerId, farm_id: farmId, payment_id: null, worker_id: null, name: 'Capina', description: null,
      category: 'Manutenção', duration: 4, price: 200, expires_at: null, status, insertion_date: NOW
    });
    return s.id;
  }

  it('remove em cascata (candidaturas, serviços, fazendas, fotos, conta) e avisa quem tinha se candidatado', async () => {
    const photoId = await t.images.save({ bytes: new Uint8Array([1]), contentType: 'image/webp', width: 1, height: 1 });
    const profileId = await t.images.save({ bytes: new Uint8Array([2]), contentType: 'image/webp', width: 1, height: 1 });
    const farmer = await givenFarmer(t, { photo_url: t.images.urlFor(profileId) });
    const farm = await givenFarm(t, farmer, { photos: [{ id: photoId, url: t.images.urlFor(photoId) }] });
    const serviceId = await serviceOf(farmer.id, farm.id, 'Pending');
    await t.applications.create({ service_id: serviceId, worker_id: 7, status: 'Pending', insertion_date: NOW });
    await t.accounts.create({ email: farmer.email, password_hash: 'h', reset_token_digest: null, reset_expires_at: null, farmer_id: farmer.id, worker_id: null, last_role: 'farmer' });

    unwrap(await remove.execute({ farmerId: farmer.id }));

    assert.equal(await t.farmers.findById(farmer.id), undefined);
    assert.deepEqual([await t.farms.find(), await t.services.find(), await t.applications.find(), await t.accounts.find()], [[], [], [], []]);
    assert.equal(await t.images.get(photoId), undefined);
    assert.equal(await t.images.get(profileId), undefined);
    assert.deepEqual(t.published, [['worker:7:applications']]);
  });

  it('serviço em andamento bloqueia a remoção sem apagar nada', async () => {
    const farmer = await givenFarmer(t);
    const farm = await givenFarm(t, farmer);
    await serviceOf(farmer.id, farm.id, 'In Progress');

    const result = await remove.execute({ farmerId: farmer.id });

    assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
    assert.ok(await t.farmers.findById(farmer.id));
    assert.equal((await t.farms.find()).length, 1);
  });

  it('produtor inexistente dá not_found', async () => {
    const result = await remove.execute({ farmerId: 99 });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
