import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { parseJobFilters, parseServiceInput, parseServiceUpdate } from './service.parsers';

const kind = (r: { ok: boolean; kind?: string }): string => (r.ok ? 'ok' : (r.kind ?? ''));
const body = { farmer_id: 1, farm_id: 1, name: 'Cerca', duration: 8, price: 300 };

describe('parsers dos serviços: categoria e grupo', () => {
  it('publicar aceita só serviço da lista (antigo ou novo), nunca o grupo', () => {
    assert.equal(unwrap(parseServiceInput({ ...body, category: 'Conserto de cerca' })).category, 'Conserto de cerca');
    assert.equal(unwrap(parseServiceInput({ ...body, category: ' Manutenção ' })).category, 'Manutenção');
    assert.equal(kind(parseServiceInput({ ...body, category: 'Pescaria' })), 'invalid');
    assert.equal(kind(parseServiceInput({ ...body, category: 'Cercas e construções' })), 'invalid');
  });

  it('editar valida a categoria só quando ela vem no corpo', () => {
    assert.deepEqual(unwrap(parseServiceUpdate({ price: 350 })), { price: 350 });
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
