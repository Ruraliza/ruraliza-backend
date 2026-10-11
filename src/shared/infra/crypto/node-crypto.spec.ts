import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHmacSessionTokens } from './node-crypto';

const NOW = '2026-01-01T00:00:00.000Z';

describe('Token de sessão', () => {
  it('confere a assinatura e a validade', () => {
    let now = NOW;
    const tokens = createHmacSessionTokens('segredo', { now: () => now }, 60_000);
    const token = tokens.issue({ kind: 'system', id: 7 });
    assert.deepEqual(tokens.verify(token), { kind: 'system', id: 7 });

    // Trocar o payload (ex.: virar outra conta) invalida a assinatura.
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ kind: 'system', id: 1, exp: Date.parse(NOW) + 60_000 })).toString('base64url')}.${signature ?? ''}`;
    assert.equal(tokens.verify(forged), null);
    assert.equal(createHmacSessionTokens('outro-segredo', { now: () => now }).verify(token), null);
    assert.equal(tokens.verify('lixo'), null);

    now = new Date(Date.parse(NOW) + 60_000).toISOString();
    assert.equal(tokens.verify(token), null);
  });
});
