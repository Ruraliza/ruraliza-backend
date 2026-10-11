import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { NOW, PDF, type WorkersTestbed, givenFarm, givenService, givenWorker, workersTestbed } from '../testing/worker-fixtures';
import { DeleteWorkerUseCase } from './delete-worker.usecase';

describe('DeleteWorkerUseCase', () => {
  let t: WorkersTestbed;
  let remove: DeleteWorkerUseCase;

  beforeEach(() => {
    t = workersTestbed();
    remove = new DeleteWorkerUseCase(t);
  });

  it('remove candidaturas, foto, currículo e o perfil na conta, e avisa as telas dos serviços', async () => {
    const photoId = await t.images.save({ bytes: new Uint8Array([1]), contentType: 'image/webp', width: 1, height: 1 });
    const resumeId = await t.documents.save({ bytes: PDF, contentType: 'application/pdf' });
    const worker = await givenWorker(t, { photo_url: t.images.urlFor(photoId), resume_url: t.documents.urlFor(resumeId) });
    const service = await givenService(t, await givenFarm(t));
    await t.applications.create({ service_id: service.id, worker_id: worker.id, status: 'Pending', insertion_date: NOW });
    await t.accounts.create({ email: worker.email, password_hash: 'h', reset_token_digest: null, reset_expires_at: null, farmer_id: null, worker_id: worker.id, last_role: 'worker' });

    unwrap(await remove.execute({ workerId: worker.id }));

    assert.equal(await t.workers.findById(worker.id), undefined);
    assert.deepEqual([await t.applications.find(), await t.accounts.find()], [[], []]);
    assert.equal(await t.images.get(photoId), undefined);
    assert.equal(await t.documents.get(resumeId), undefined);
    assert.deepEqual(t.published, [[`service:${service.id}:applications`]]);
  });

  it('serviço em andamento atribuído a ele bloqueia a remoção', async () => {
    const worker = await givenWorker(t);
    await givenService(t, await givenFarm(t), { status: 'In Progress', worker_id: worker.id });

    const result = await remove.execute({ workerId: worker.id });

    assert.equal(result.ok ? 'ok' : result.kind, 'conflict');
    assert.ok(await t.workers.findById(worker.id));
  });
});
