import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type TracksTestbed, givenTrack, givenTutor, givenWorker, tracksTestbed } from '../testing/track-fixtures';
import { GetTrackDetailUseCase } from './get-track-detail.usecase';

describe('GetTrackDetailUseCase', () => {
  let t: TracksTestbed;
  let detail: GetTrackDetailUseCase;
  let tutorId: number;

  beforeEach(async () => {
    t = tracksTestbed();
    detail = new GetTrackDetailUseCase(t);
    tutorId = (await givenTutor(t)).id;
  });

  it('traz o sumário sem o conteúdo nem o link das aulas', async () => {
    const track = await givenTrack(t, tutorId);

    const result = unwrap(await detail.execute({ trackId: track.id }));

    assert.deepEqual(result.modules[0], {
      id: 1, title: 'Preparação', lessons: [
        { id: 2, title: 'Quando colher', duration_minutes: 10, has_video: true },
        { id: 3, title: 'Equipamentos', duration_minutes: 20, has_video: false }
      ]
    });
    assert.equal(result.progress, null);
  });

  it('rascunho não existe; descontinuada só para quem já começou', async () => {
    const worker = await givenWorker(t);
    const draft = await givenTrack(t, tutorId, { status: 'draft' });
    const gone = await givenTrack(t, tutorId, { status: 'discontinued' });

    for (const trackId of [draft.id, gone.id, 99]) {
      const result = await detail.execute({ trackId, workerId: worker.id });
      assert.equal(result.ok ? 'ok' : result.kind, 'not_found');
    }
    await t.enrollments.create({ track_id: gone.id, worker_id: worker.id, completed_lesson_ids: [3], last_lesson_id: 3, started_at: '2026-10-01T00:00:00.000Z', completed_at: null });
    const enrolled = unwrap(await detail.execute({ trackId: gone.id, workerId: worker.id }));
    assert.deepEqual([enrolled.progress?.completed_lessons, enrolled.progress?.last_lesson_id], [1, 3]);
  });
});
