import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { parseJobFilters, parseServiceInput, parseServiceUpdate } from './service.parsers';

const kind = (r: { ok: boolean; kind?: string }): string => (r.ok ? 'ok' : (r.kind ?? ''));
const body = { farmer_id: 1, farm_id: 1, name: 'Cerca', duration: 8, price: 150, price_unit: 'day' };

describe('parsers dos serviços: categoria e grupo', () => {
  it('publicar aceita só serviço da lista (antigo ou novo), nunca o grupo', () => {
    assert.equal(unwrap(parseServiceInput({ ...body, category: 'Conserto de cerca' })).category, 'Conserto de cerca');
    assert.equal(unwrap(parseServiceInput({ ...body, category: ' Manutenção ' })).category, 'Manutenção');
    assert.equal(kind(parseServiceInput({ ...body, category: 'Pescaria' })), 'invalid');
    assert.equal(kind(parseServiceInput({ ...body, category: 'Cercas e construções' })), 'invalid');
  });

  it('editar valida a categoria só quando ela vem no corpo', () => {
    assert.deepEqual(unwrap(parseServiceUpdate({ duration: 6 })), { duration: 6 });
    assert.equal(unwrap(parseServiceUpdate({ category: 'Ordenha' })).category, 'Ordenha');
    assert.equal(kind(parseServiceUpdate({ category: 'Motosserra' })), 'invalid');
  });

  it('category_group: grupo válido entra no filtro; desconhecido, 400 em português', () => {
    assert.deepEqual(unwrap(parseJobFilters({ category_group: 'Água', category: 'Ordenha', q: 'leite' })), {
      category_group: 'Água', category: 'Ordenha', q: 'leite'
    });
    const unknownGroup = parseJobFilters({ category_group: 'Pescaria' });
    assert.equal(kind(unknownGroup), 'invalid');
    assert.match(unknownGroup.ok ? '' : unknownGroup.message, /Grupo de serviço desconhecido/);
    assert.equal(kind(parseJobFilters({ category_group: 'Colheita' })), 'invalid');
    assert.equal(kind(parseJobFilters({ category: 'Pescaria' })), 'invalid');
  });
});

describe('parsers dos serviços: valor estimado', () => {
  const input = { ...body, category: 'Capina' };

  it('publicar exige o valor e a unidade, juntos e válidos', () => {
    assert.deepEqual(
      [unwrap(parseServiceInput(input)).price, unwrap(parseServiceInput(input)).price_unit],
      [150, 'day']
    );
    assert.equal(kind(parseServiceInput({ ...input, price: undefined })), 'invalid');
    assert.equal(kind(parseServiceInput({ ...input, price_unit: undefined })), 'invalid');
    for (const price of [0, -10, '150']) assert.equal(kind(parseServiceInput({ ...input, price })), 'invalid');
    assert.equal(kind(parseServiceInput({ ...input, price_unit: 'semana' })), 'invalid');
  });

  it('editar aceita a estimativa só com o valor e a unidade juntos', () => {
    assert.deepEqual(unwrap(parseServiceUpdate({ price: 40, price_unit: 'hour' })), { price: 40, price_unit: 'hour' });
    assert.equal(kind(parseServiceUpdate({ price: 40 })), 'invalid');
    assert.equal(kind(parseServiceUpdate({ price_unit: 'hour' })), 'invalid');
  });
});
