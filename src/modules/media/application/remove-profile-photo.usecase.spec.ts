import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type MediaTestbed, givenFarmer, givenWorker, mediaTestbed, storedImageUrl } from '../testing/media-fixtures';
import { RemoveFarmerPhotoUseCase } from './remove-farmer-photo.usecase';
import { RemoveWorkerPhotoUseCase } from './remove-worker-photo.usecase';

describe('RemoveFarmerPhotoUseCase / RemoveWorkerPhotoUseCase', () => {
  let t: MediaTestbed;

  beforeEach(() => {
    t = mediaTestbed();
  });

  it('limpa photo_url e apaga a imagem do store', async () => {
    const farmerUrl = await storedImageUrl(t);
    const workerUrl = await storedImageUrl(t);
    const farmer = await givenFarmer(t, farmerUrl);
    const worker = await givenWorker(t, workerUrl);

    assert.equal(unwrap(await new RemoveFarmerPhotoUseCase(t).execute({ farmerId: farmer.id })).photo_url, null);
    assert.equal(unwrap(await new RemoveWorkerPhotoUseCase(t).execute({ workerId: worker.id })).photo_url, null);

    for (const url of [farmerUrl, workerUrl]) {
      const id = t.images.store.idFromUrl(url);
      assert.equal(id && (await t.images.store.get(id)), undefined);
    }
  });

  it('sem foto não é erro; perfil inexistente dá not_found', async () => {
    const farmer = await givenFarmer(t);

    unwrap(await new RemoveFarmerPhotoUseCase(t).execute({ farmerId: farmer.id }));
    const missing = await new RemoveWorkerPhotoUseCase(t).execute({ workerId: 99 });
    assert.equal(missing.ok ? 'ok' : missing.kind, 'not_found');
  });
});
