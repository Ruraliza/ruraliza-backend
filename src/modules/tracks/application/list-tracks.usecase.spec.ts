import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { type TracksTestbed, givenTrack, givenTutor, givenWorker, tracksTestbed } from '../testing/track-fixtures';
import { ListTracksUseCase } from './list-tracks.usecase';

describe('ListTracksUseCase', () => {
  let t: TracksTestbed;
  let list: ListTracksUseCase;
  let tutorId: number;

  beforeEach(async () => {
    t = tracksTestbed();
    list = new ListTracksUseCase(t);
    tutorId = (await givenTutor(t)).id;
  });

  it('mostra só as publicadas, com carga horária, contagens e tutores', async () => {
    const live = await givenTrack(t, tutorId);
    await givenTrack(t, tutorId, { status: 'draft' });
    await givenTrack(t, tutorId, { status: 'discontinued' });

    const [only, ...rest] = await list.execute();

    assert.equal(rest.length, 0);
    assert.deepEqual(only, {
      id: live.id, title: 'Colheita de café', description: 'Do ponto de colheita à secagem.', categories: ['Colheita'], status: 'published',
      tutors: [{ id: tutorId, name: 'Tiago Tutor' }], workload_minutes: 60, module_count: 2, lesson_count: 3, published_at: live.published_at, progress: null
    });
  });

  it('filtra por categoria e por busca sem acento (todas as palavras)', async () => {
    await givenTrack(t, tutorId, { title: 'Colheita de café' });
    await givenTrack(t, tutorId, { title: 'Trator na prática', categories: ['Operação de máquinas'] });

    assert.deepEqual((await list.execute({ category: 'Operação de máquinas' })).map((x) => x.title), ['Trator na prática']);
    assert.deepEqual((await list.execute({ q: 'CAFE colheita' })).map((x) => x.title), ['Colheita de café']);
    assert.deepEqual((await list.execute({ q: 'maquinas' })).map((x) => x.title), ['Trator na prática']);
    assert.deepEqual(await list.execute({ q: 'café trator' }), []);
  });

  it('com worker_id: progresso, em andamento primeiro, e a descontinuada em que ele está matriculado', async () => {
    const worker = await givenWorker(t);
    const older = await givenTrack(t, tutorId, { title: 'Antiga', published_at: '2026-09-01T00:00:00.000Z' });
    await givenTrack(t, tutorId, { title: 'Nova', published_at: '2026-10-01T00:00:00.000Z' });
    const gone = await givenTrack(t, tutorId, { title: 'Descontinuada', status: 'discontinued', published_at: '2026-08-01T00:00:00.000Z' });
    await givenTrack(t, tutorId, { title: 'Descontinuada sem aluno', status: 'discontinued' });
    for (const [trackId, done] of [[older.id, [2]], [gone.id, []]] as const) {
      await t.enrollments.create({ track_id: trackId, worker_id: worker.id, completed_lesson_ids: [...done], last_lesson_id: null, started_at: '2026-10-01T00:00:00.000Z', completed_at: null });
    }

    const result = await list.execute({ worker_id: worker.id });

    assert.deepEqual(result.map((x) => [x.title, x.progress?.percent ?? null]), [['Antiga', 33], ['Descontinuada', 0], ['Nova', null]]);
  });
});
