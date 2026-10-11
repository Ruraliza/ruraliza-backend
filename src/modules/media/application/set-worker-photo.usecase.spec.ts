import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { IMAGE, type MediaTestbed, NOT_IMAGE, givenWorker, mediaTestbed } from '../testing/media-fixtures';
import { SetWorkerPhotoUseCase } from './set-worker-photo.usecase';

describe('SetWorkerPhotoUseCase', () => {
  let t: MediaTestbed;
  let setPhoto: SetWorkerPhotoUseCase;

  beforeEach(() => {
    t = mediaTestbed();
    setPhoto = new SetWorkerPhotoUseCase(t);
  });

  it('guarda a foto quadrada e grava a URL no trabalhador', async () => {
    const worker = await givenWorker(t);

    const updated = unwrap(await setPhoto.execute({ workerId: worker.id, upload: IMAGE }));

    assert.deepEqual(t.images.processor.calls, [{ square: true }]);
    assert.match(updated.photo_url ?? '', /^\/api\/images\//);
  });

  it('arquivo que não é imagem dá invalid; trabalhador inexistente dá not_found', async () => {
    const worker = await givenWorker(t);

    const bad = await setPhoto.execute({ workerId: worker.id, upload: NOT_IMAGE });
    assert.equal(bad.ok ? 'ok' : bad.kind, 'invalid');
    assert.equal((await t.workers.findById(worker.id))?.photo_url, null);
    const missing = await setPhoto.execute({ workerId: 99, upload: IMAGE });
    assert.equal(missing.ok ? 'ok' : missing.kind, 'not_found');
  });
});
