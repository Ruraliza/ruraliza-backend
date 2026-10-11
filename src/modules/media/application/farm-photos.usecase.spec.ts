import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MAX_FARM_PHOTOS } from '#shared/domain/images';
import { unwrap } from '#shared/testing/unwrap';
import { IMAGE, type MediaTestbed, NOW, givenFarm, givenFarmer, mediaTestbed } from '../testing/media-fixtures';
import { AddFarmPhotoUseCase } from './add-farm-photo.usecase';
import { RemoveFarmPhotoUseCase } from './remove-farm-photo.usecase';

describe('AddFarmPhotoUseCase / RemoveFarmPhotoUseCase', () => {
  let t: MediaTestbed;
  let add: AddFarmPhotoUseCase;
  let remove: RemoveFarmPhotoUseCase;

  beforeEach(() => {
    t = mediaTestbed();
    add = new AddFarmPhotoUseCase(t);
    remove = new RemoveFarmPhotoUseCase(t);
  });

  it('acrescenta no fim, mantendo a proporção (sem recorte quadrado)', async () => {
    const farmer = await givenFarmer(t);
    const farm = await givenFarm(t, farmer);

    const first = unwrap(await add.execute({ farmerId: farmer.id, farmId: farm.id, upload: IMAGE }));
    const second = unwrap(await add.execute({ farmerId: farmer.id, farmId: farm.id, upload: IMAGE }));

    assert.deepEqual(t.images.processor.calls, [undefined, undefined]);
    assert.equal(second.photos.length, 2);
    assert.deepEqual(second.photos[0], first.photos[0]);
  });

  it(`recusa a ${MAX_FARM_PHOTOS + 1}ª foto`, async () => {
    const farmer = await givenFarmer(t);
    const photos = Array.from({ length: MAX_FARM_PHOTOS }, (_, i) => ({ id: `${i}.webp`, url: `/api/images/${i}.webp` }));
    const farm = await givenFarm(t, farmer, { photos });

    const result = await add.execute({ farmerId: farmer.id, farmId: farm.id, upload: IMAGE });

    assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
  });

  it('remove a foto escolhida da fazenda e do store', async () => {
    const farmer = await givenFarmer(t);
    const farm = await givenFarm(t, farmer);
    const withPhotos = unwrap(await add.execute({ farmerId: farmer.id, farmId: farm.id, upload: IMAGE }));
    const [photo] = withPhotos.photos;

    const updated = unwrap(await remove.execute({ farmerId: farmer.id, farmId: farm.id, photoId: photo?.id ?? '' }));

    assert.deepEqual(updated.photos, []);
    assert.equal(await t.images.store.get(photo?.id ?? ''), undefined);
    const missing = await remove.execute({ farmerId: farmer.id, farmId: farm.id, photoId: 'nao-existe.webp' });
    assert.equal(missing.ok ? 'ok' : missing.kind, 'not_found');
  });

  it('fazenda de outro produtor ou arquivada dá not_found', async () => {
    const farmer = await givenFarmer(t);
    const archived = await givenFarm(t, farmer, { deleted_at: NOW });
    const other = await t.farmers.create({ email: 'bia@exemplo.com', name: 'Bia', phone: '1', cpf: '11144477735', farms: [], photo_url: null, insertion_date: NOW });
    const farm = await givenFarm(t, farmer);

    for (const input of [{ farmerId: farmer.id, farmId: archived.id }, { farmerId: other.id, farmId: farm.id }]) {
      const result = await add.execute({ ...input, upload: IMAGE });
      assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
    }
  });
});
