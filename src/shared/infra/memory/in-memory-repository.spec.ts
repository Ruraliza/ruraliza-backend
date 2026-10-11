import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InMemoryRepository } from './in-memory-repository';

describe('InMemoryRepository', () => {
  it('devolve cópias: alterar sem update não persiste', async () => {
    const repo = new InMemoryRepository<{ id: number; name: string }, 'name'>(['name'], (data, id) => ({ id, ...data }));
    const created = await repo.create({ name: 'a' });

    created.name = 'mudado';
    assert.equal((await repo.findById(created.id))?.name, 'a');

    await repo.update(created);
    assert.equal((await repo.findById(created.id))?.name, 'mudado');
    assert.deepEqual(await repo.find({ name: 'mudado' }), [{ id: created.id, name: 'mudado' }]);
  });
});
