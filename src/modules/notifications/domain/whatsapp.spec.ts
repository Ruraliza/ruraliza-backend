import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { whatsappNumber } from './whatsapp';

describe('whatsappNumber', () => {
  it('põe o DDI 55 no celular com DDD', () => {
    assert.equal(whatsappNumber('24999998888'), '5524999998888');
    assert.equal(whatsappNumber('(24) 99999-8888'), '5524999998888');
    assert.equal(whatsappNumber('5524999998888'), '5524999998888');
  });

  it('recusa fixo, número sem DDD e lixo', () => {
    assert.equal(whatsappNumber('2433334444'), null);
    assert.equal(whatsappNumber('999998888'), null);
    assert.equal(whatsappNumber('1'), null);
    assert.equal(whatsappNumber('00999998888'), null);
  });
});
