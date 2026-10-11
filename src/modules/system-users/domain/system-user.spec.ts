import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canDo } from './system-user';

describe('permissões da equipe', () => {
  it('o administrador gerencia contas e equipe; o tutor, as trilhas', () => {
    assert.deepEqual(
      (['users:manage', 'system-users:manage', 'tracks:manage'] as const).map((p) => [canDo('admin', p), canDo('tutor', p)]),
      [[true, false], [true, false], [false, true]]
    );
  });
});
