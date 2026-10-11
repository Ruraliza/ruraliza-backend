import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import type { LessonInput, TrackContentInput } from '../track.contract';
import { type TracksTestbed, asTutor, givenTrack, givenTutor, tracksTestbed } from '../testing/track-fixtures';
import { SaveTrackContentUseCase } from './save-track-content.usecase';

const lesson = (title: string, id?: number): LessonInput => ({ ...(id === undefined ? {} : { id }), title, content: 'texto', duration_minutes: 10 });

describe('SaveTrackContentUseCase', () => {
  let t: TracksTestbed;
  let save: SaveTrackContentUseCase;
  let tutorId: number;

  beforeEach(async () => {
    t = tracksTestbed();
    save = new SaveTrackContentUseCase(t);
    tutorId = (await givenTutor(t)).id;
  });

  it('mantém os ids enviados, dá ids novos depois de last_item_id e move aula entre módulos', async () => {
    const track = await givenTrack(t, tutorId);
    const content: TrackContentInput = {
      modules: [
        { id: 4, title: 'Na lavoura', lessons: [lesson('Derriça', 5), lesson('Quando colher', 2)] },
        { title: 'Pós-colheita', lessons: [lesson('Secagem'), lesson('Armazenagem')] }
      ]
    };

    const saved = unwrap(await save.execute({ actor: asTutor(tutorId), trackId: track.id, content }));

    assert.deepEqual(saved.modules.map((m) => [m.id, m.lessons.map((l) => l.id)]), [[4, [5, 2]], [6, [7, 8]]]);
    assert.equal(saved.workload_minutes, 40);
    assert.equal((await t.tracks.findById(track.id))?.last_item_id, 8);
  });

  it('ids removidos não voltam: o próximo item novo continua depois do maior já dado', async () => {
    const track = await givenTrack(t, tutorId, { status: 'draft' });
    unwrap(await save.execute({ actor: asTutor(tutorId), trackId: track.id, content: { modules: [] } }));

    const saved = unwrap(await save.execute({ actor: asTutor(tutorId), trackId: track.id, content: { modules: [{ title: 'Novo', lessons: [lesson('A')] }] } }));

    assert.deepEqual(saved.modules.map((m) => [m.id, m.lessons.map((l) => l.id)]), [[6, [7]]]);
  });

  it('recusa id que não existe na trilha, id repetido e id de módulo usado como aula', async () => {
    const track = await givenTrack(t, tutorId);
    const cases: TrackContentInput[] = [
      { modules: [{ id: 99, title: 'M', lessons: [lesson('A')] }] },
      { modules: [{ id: 1, title: 'M', lessons: [lesson('A', 2), lesson('B', 2)] }] },
      { modules: [{ id: 1, title: 'M', lessons: [lesson('A', 4)] }] }
    ];
    for (const content of cases) {
      const result = await save.execute({ actor: asTutor(tutorId), trackId: track.id, content });
      assert.equal(result.ok ? 'ok' : result.kind, 'invalid', JSON.stringify(content));
    }
  });

  it('trilha no ar não pode ficar sem aulas nem com módulo vazio (rascunho pode)', async () => {
    const live = await givenTrack(t, tutorId);
    const empty = await save.execute({ actor: asTutor(tutorId), trackId: live.id, content: { modules: [{ id: 1, title: 'M', lessons: [] }] } });
    assert.equal(empty.ok ? 'ok' : empty.kind, 'conflict');

    const draft = await givenTrack(t, tutorId, { status: 'draft' });
    unwrap(await save.execute({ actor: asTutor(tutorId), trackId: draft.id, content: { modules: [{ title: 'Ainda vazio', lessons: [] }] } }));
  });

  it('só os tutores da trilha salvam', async () => {
    const track = await givenTrack(t, tutorId);
    const bia = await givenTutor(t, 'Bia Tutora');
    const result = await save.execute({ actor: asTutor(bia.id), trackId: track.id, content: { modules: [] } });
    assert.equal(result.ok ? 'ok' : result.kind, 'forbidden');
  });
});
