import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { PDF, type WorkersTestbed, givenWorker, workersTestbed } from '../testing/worker-fixtures';
import { GetDocumentUseCase } from './get-document.usecase';
import { RemoveWorkerResumeUseCase } from './remove-worker-resume.usecase';
import { SetWorkerResumeUseCase } from './set-worker-resume.usecase';

describe('currículo do trabalhador', () => {
  let t: WorkersTestbed;

  beforeEach(() => {
    t = workersTestbed();
  });

  it('guarda o PDF como veio; enviar de novo troca e apaga o anterior', async () => {
    const worker = await givenWorker(t);
    const setResume = new SetWorkerResumeUseCase(t);

    const first = unwrap(await setResume.execute({ workerId: worker.id, upload: PDF })).resume_url ?? '';
    const second = unwrap(await setResume.execute({ workerId: worker.id, upload: PDF })).resume_url ?? '';

    assert.notEqual(first, second);
    const getDocument = new GetDocumentUseCase(t);
    assert.deepEqual(unwrap(await getDocument.execute({ documentId: t.documents.idFromUrl(second) ?? '' })), { bytes: PDF, contentType: 'application/pdf' });
    const old = await getDocument.execute({ documentId: t.documents.idFromUrl(first) ?? '' });
    assert.equal(old.ok ? 'ok' : old.kind, 'not_found');
  });

  it('arquivo que não é PDF dá invalid', async () => {
    const worker = await givenWorker(t);

    const result = await new SetWorkerResumeUseCase(t).execute({ workerId: worker.id, upload: new TextEncoder().encode('texto') });

    assert.equal(result.ok ? 'ok' : result.kind, 'invalid');
    assert.equal((await t.workers.findById(worker.id))?.resume_url, null);
  });

  it('remover limpa resume_url e apaga o PDF', async () => {
    const worker = await givenWorker(t);
    const url = unwrap(await new SetWorkerResumeUseCase(t).execute({ workerId: worker.id, upload: PDF })).resume_url ?? '';

    assert.equal(unwrap(await new RemoveWorkerResumeUseCase(t).execute({ workerId: worker.id })).resume_url, null);
    assert.equal(await t.documents.get(t.documents.idFromUrl(url) ?? ''), undefined);
  });
});
