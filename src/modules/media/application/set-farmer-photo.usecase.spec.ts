import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { IMAGE, type MediaTestbed, NOT_IMAGE, givenFarmer, mediaTestbed, storedImageUrl } from '../testing/media-fixtures';
import { SetFarmerPhotoUseCase } from './set-farmer-photo.usecase';

describe('SetFarmerPhotoUseCase', () => {
  let t: MediaTestbed;
  let setPhoto: SetFarmerPhotoUseCase;

  beforeEach(() => {
    t = mediaTestbed();
    setPhoto = new SetFarmerPhotoUseCase(t);
  });

  it('processa como quadrada, guarda e troca a URL, apagando a foto anterior', async () => {
    const old = await storedImageUrl(t);
    const farmer = await givenFarmer(t, old);

    const updated = unwrap(await setPhoto.execute({ farmerId: farmer.id, upload: IMAGE }));

    assert.deepEqual(t.images.processor.calls, [{ square: true }]);
    assert.notEqual(updated.photo_url, old);
    assert.equal((await t.farmers.findById(farmer.id))?.photo_url, updated.photo_url);
    const oldId = t.images.store.idFromUrl(old);
    assert.equal(oldId && (await t.images.store.get(oldId)), undefined);
  });

  it('arquivo que não é imagem dá invalid e mantém a foto atual', async () => {
    const old = await storedImageUrl(t);
    const farmer = await givenFarmer(t, old);

    const result = await setPhoto.execute({ farmerId: farmer.id, upload: NOT_IMAGE });

    assert.equal(result.ok ? 'ok' : result.kind, 'invalid');
    assert.equal((await t.farmers.findById(farmer.id))?.photo_url, old);
  });

  it('produtor inexistente dá not_found', async () => {
    const result = await setPhoto.execute({ farmerId: 99, upload: IMAGE });

    assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
  });
});
