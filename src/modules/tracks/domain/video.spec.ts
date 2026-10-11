import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonicalVideoUrl } from './video';

describe('canonicalVideoUrl', () => {
  it('aceita os formatos do YouTube e guarda o link de watch', () => {
    const expected = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    for (const link of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      ' https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ '
    ]) {
      assert.equal(canonicalVideoUrl(link), expected, link);
    }
  });

  it('aceita o Vimeo (página e player)', () => {
    assert.equal(canonicalVideoUrl('https://vimeo.com/76979871'), 'https://vimeo.com/76979871');
    assert.equal(canonicalVideoUrl('https://player.vimeo.com/video/76979871?h=x'), 'https://vimeo.com/76979871');
  });

  it('recusa outros sites, ids malformados e esquemas perigosos', () => {
    for (const link of [
      'https://exemplo.com/video.mp4',
      'https://www.youtube.com/watch?v=curto',
      'https://www.youtube.com/channel/UC123',
      'https://vimeo.com/canal',
      'javascript:alert(1)',
      'não é link'
    ]) {
      assert.equal(canonicalVideoUrl(link), null, link);
    }
  });
});
