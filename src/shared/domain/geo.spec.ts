import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { distanceKm } from './geo';

describe('distanceKm', () => {
  it('mede em linha reta, em km', () => {
    const tresRios = { latitude: -22.1165, longitude: -43.2092 };
    const petropolis = { latitude: -22.505, longitude: -43.1789 };

    assert.equal(distanceKm(tresRios, tresRios), 0);
    assert.equal(Math.round(distanceKm(tresRios, petropolis)), 43);
  });
});
