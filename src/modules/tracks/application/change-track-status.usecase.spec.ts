import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { NOW, type TracksTestbed, givenTrack, givenTutor, tracksTestbed } from '../testing/track-fixtures';
import { ChangeTrackStatusUseCase } from './change-track-status.usecase';

describe('ChangeTrackStatusUseCase', () => {
  let t: TracksTestbed;
  let change: ChangeTrackStatusUseCase;
  let tutorId: number;

  beforeEach(async () => {
    t = tracksTestbed();
    change = new ChangeTrackStatusUseCase(t);
    tutorId = (await givenTutor(t)).id;
  });

  it('publica o rascunho (com a data), descontinua e reativa sem perder a data da primeira publicação', async () => {
    const track = await givenTrack(t, tutorId, { status: 'draft', published_at: null });

    t.setNow('2026-10-05T10:00:00.000Z');
    const published = unwrap(await change.execute({ actorId: tutorId, trackId: track.id, status: 'published' }));
    assert.deepEqual([published.status, published.published_at], ['published', '2026-10-05T10:00:00.000Z']);

    const discontinued = unwrap(await change.execute({ actorId: tutorId, trackId: track.id, status: 'discontinued' }));
    assert.equal(discontinued.status, 'discontinued');

    t.setNow('2026-11-01T10:00:00.000Z');
    const back = unwrap(await change.execute({ actorId: tutorId, trackId: track.id, status: 'published' }));
    assert.deepEqual([back.status, back.published_at, back.updated_at], ['published', '2026-10-05T10:00:00.000Z', '2026-11-01T10:00:00.000Z']);
  });

  it('não publica sem aulas, e não pula de rascunho para descontinuada', async () => {
    const empty = await givenTrack(t, tutorId, { status: 'draft', modules: [], published_at: null });
    const noLessons = await change.execute({ actorId: tutorId, trackId: empty.id, status: 'published' });
    assert.equal(noLessons.ok ? 'ok' : noLessons.kind, 'conflict');

    const skip = await change.execute({ actorId: tutorId, trackId: empty.id, status: 'discontinued' });
    assert.equal(skip.ok ? 'ok' : skip.kind, 'conflict');
    assert.equal((await t.tracks.findById(empty.id))?.status, 'draft');
  });

  it('só os tutores da trilha mudam o status', async () => {
    const track = await givenTrack(t, tutorId);
    const bia = await givenTutor(t, 'Bia Tutora');
    const result = await change.execute({ actorId: bia.id, trackId: track.id, status: 'discontinued' });
    assert.equal(result.ok ? 'ok' : result.kind, 'forbidden');
    assert.equal((await t.tracks.findById(track.id))?.updated_at, NOW);
  });
});
