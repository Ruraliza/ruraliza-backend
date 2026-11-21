import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORIES, CATEGORY_GROUPS, CATEGORY_GROUP_NAMES, isCategory, servicesOfGroup } from './categories';

// Os valores que já estão gravados em services, job_preferences, sponsors e tracks.
const ORIGINAL = ['Colheita', 'Plantio', 'Manutenção', 'Pulverização', 'Operação de máquinas', 'Manejo de gado', 'Outros'];

describe('tipos de serviço (grupo > serviço)', () => {
  it('cada serviço está em exatamente um grupo, sem nomes repetidos', () => {
    const all = CATEGORY_GROUPS.flatMap((g) => g.services);
    assert.equal(new Set(all).size, all.length);
    for (const service of all) assert.equal(CATEGORY_GROUPS.filter((g) => g.services.includes(service)).length, 1, service);
    assert.equal(new Set(CATEGORY_GROUP_NAMES).size, CATEGORY_GROUP_NAMES.length);
  });

  it('nenhum grupo está vazio', () => {
    for (const group of CATEGORY_GROUPS) assert.ok(group.services.length > 0, group.name);
  });

  it('a lista plana é derivada dos grupos e mantém os 7 valores antigos', () => {
    assert.deepEqual([...CATEGORIES], CATEGORY_GROUPS.flatMap((g) => g.services));
    for (const value of ORIGINAL) assert.ok(isCategory(value), value);
  });

  it('acha os serviços do grupo e recusa o que não existe', () => {
    assert.deepEqual(servicesOfGroup('Máquinas'), ['Operação de máquinas']);
    assert.equal(servicesOfGroup('Pescaria'), undefined);
    assert.equal(isCategory('Lavoura e horta'), false);
    assert.equal(isCategory(42), false);
  });
});
