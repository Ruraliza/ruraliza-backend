import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { randomCertificateCodes } from './random-certificate-codes';

describe('randomCertificateCodes', () => {
  it('gera códigos legíveis e diferentes', () => {
    const codes = new Set(Array.from({ length: 200 }, () => randomCertificateCodes.create()));
    assert.equal(codes.size, 200);
    for (const code of codes) assert.match(code, /^RZ-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/);
  });
});
