import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { certificateHashText } from '../domain/certificate';
import { sha256CertificateHasher } from './sha256-certificate-hasher';

const DATA = { code: 'RZ-7K3Q-9FMA-2X', worker_name: 'Maria Trabalhadora', track_title: 'Colheita de café', workload_minutes: 90, completed_at: '2026-10-03T18:00:00.000Z' };

describe('sha256CertificateHasher', () => {
  it('resume o JSON dos dados impressos, num formato que qualquer um recalcula', () => {
    assert.equal(certificateHashText(DATA), '["RZ-7K3Q-9FMA-2X","Maria Trabalhadora","Colheita de café",90,"2026-10-03T18:00:00.000Z"]');
    // Conferido fora do Node: hashlib.sha256 do Python sobre o mesmo texto em UTF-8.
    assert.equal(sha256CertificateHasher.hash(DATA), '2477ab9df8d56acff58145d14b245184c8ab787ee12baf2a4ab81613394ec822');
  });

  it('qualquer dado diferente dá outro resumo', () => {
    const changes = [{ code: 'RZ-7K3Q-9FMA-2Y' }, { worker_name: 'Maria Trabalhador' }, { track_title: 'Colheita de cafe' }, { workload_minutes: 900 }, { completed_at: '2026-10-04T18:00:00.000Z' }];
    const hashes = new Set([DATA, ...changes.map((change) => ({ ...DATA, ...change }))].map((data) => sha256CertificateHasher.hash(data)));
    assert.equal(hashes.size, changes.length + 1);
  });
});
