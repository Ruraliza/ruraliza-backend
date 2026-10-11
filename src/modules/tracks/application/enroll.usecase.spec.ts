import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { NOW, type TracksTestbed, givenTrack, givenTutor, givenWorker, tracksTestbed } from '../testing/track-fixtures';
import { EnrollUseCase } from './enroll.usecase';

describe('EnrollUseCase', () => {
  let t: TracksTestbed;
  let enroll: EnrollUseCase;
  let tutorId: number;

  beforeEach(async () => {
    t = tracksTestbed();
    enroll = new EnrollUseCase(t);
    tutorId = (await givenTutor(t)).id;
  });

  it('matricula e devolve a trilha completa; repetir devolve a mesma matrícula', async () => {
    const worker = await givenWorker(t);
    const track = await givenTrack(t, tutorId);

    const first = unwrap(await enroll.execute({ trackId: track.id, workerId: worker.id }));
    assert.equal(first.created, true);
    assert.deepEqual(first.track.progress, { completed_lessons: 0, total_lessons: 3, percent: 0, last_lesson_id: null, started_at: NOW, completed_at: null });
    assert.equal(first.track.modules[0]?.lessons[1]?.content, 'Luvas e peneira.');
    assert.equal(first.track.certificate_code, null);

    const again = unwrap(await enroll.execute({ trackId: track.id, workerId: worker.id }));
    assert.equal(again.created, false);
    assert.equal((await t.enrollments.find()).length, 1);
  });

  it('descontinuada não aceita aluno novo (quem já começou continua); rascunho e trabalhador inexistente dão not_found', async () => {
    const worker = await givenWorker(t);
    const gone = await givenTrack(t, tutorId, { status: 'discontinued' });
    const draft = await givenTrack(t, tutorId, { status: 'draft' });

    const closed = await enroll.execute({ trackId: gone.id, workerId: worker.id });
    assert.equal(closed.ok ? 'ok' : closed.kind, 'conflict');
    const hidden = await enroll.execute({ trackId: draft.id, workerId: worker.id });
    assert.equal(hidden.ok ? 'ok' : hidden.kind, 'not_found');
    const nobody = await enroll.execute({ trackId: gone.id, workerId: 99 });
    assert.equal(nobody.ok ? 'ok' : nobody.kind, 'not_found');

    await t.enrollments.create({ track_id: gone.id, worker_id: worker.id, completed_lesson_ids: [], last_lesson_id: null, started_at: NOW, completed_at: null });
    assert.equal(unwrap(await enroll.execute({ trackId: gone.id, workerId: worker.id })).created, false);
  });
});
