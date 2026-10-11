import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type WorkersTestbed, givenWorker, workersTestbed } from '../testing/worker-fixtures';
import { GetWorkerUseCase } from './get-worker.usecase';
import { ListWorkersUseCase } from './list-workers.usecase';
import { UpdateWorkerUseCase } from './update-worker.usecase';

describe('ListWorkersUseCase / GetWorkerUseCase / UpdateWorkerUseCase', () => {
  let t: WorkersTestbed;

  beforeEach(() => {
    t = workersTestbed();
  });

  it('a lista mascara o CPF; o perfil vem completo', async () => {
    const worker = await givenWorker(t);

    assert.deepEqual((await new ListWorkersUseCase(t).execute()).map((w) => w.cpf), ['***.444.777-**']);
    assert.equal(unwrap(await new GetWorkerUseCase(t).execute({ workerId: worker.id })).cpf, '11144477735');
  });

  it('editar troca só o que veio, e null limpa um texto', async () => {
    const worker = await givenWorker(t, { bio: 'Antiga', experience: '3 anos' });
    await t.accounts.create({ email: worker.email, password_hash: 'h', reset_token_digest: null, reset_expires_at: null, farmer_id: null, worker_id: worker.id, last_role: 'worker' });

    const updated = unwrap(await new UpdateWorkerUseCase(t).execute({ workerId: worker.id, changes: { bio: null, courses: 'NR-31' } }));

    assert.deepEqual([updated.bio, updated.courses, updated.experience], [null, 'NR-31', '3 anos']);
  });

  it('trabalhador inexistente dá not_found', async () => {
    const get = await new GetWorkerUseCase(t).execute({ workerId: 99 });
    assert.equal(get.ok ? 'ok' : get.kind, 'not_found');
    const update = await new UpdateWorkerUseCase(t).execute({ workerId: 99, changes: { name: 'X' } });
    assert.equal(update.ok ? 'ok' : update.kind, 'not_found');
  });
});
