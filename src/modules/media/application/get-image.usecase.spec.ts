import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { IMAGE, mediaTestbed, storedImageUrl } from '../testing/media-fixtures';
import { GetImageUseCase } from './get-image.usecase';

describe('GetImageUseCase', () => {
  it('devolve os bytes guardados; id desconhecido dá not_found', async () => {
    const t = mediaTestbed();
    const getImage = new GetImageUseCase(t);
    const id = t.images.store.idFromUrl(await storedImageUrl(t)) ?? '';

    assert.deepEqual(unwrap(await getImage.execute({ imageId: id })), { bytes: IMAGE, contentType: 'image/webp' });
    const missing = await getImage.execute({ imageId: 'nao-existe.webp' });
    assert.equal(missing.ok ? 'ok' : missing.kind, 'not_found');
  });
});
