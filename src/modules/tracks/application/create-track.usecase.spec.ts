import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { NOW, type TracksTestbed, givenTutor, tracksTestbed } from '../testing/track-fixtures';
import { CreateTrackUseCase } from './create-track.usecase';

describe('CreateTrackUseCase', () => {
  let t: TracksTestbed;

  beforeEach(() => {
    t = tracksTestbed();
  });

  it('cria em rascunho, sem conteúdo, com quem criou como tutor', async () => {
    const tutor = await givenTutor(t);

    const track = unwrap(await new CreateTrackUseCase(t).execute({
      actorId: tutor.id, input: { title: 'Pulverização segura', description: 'EPI e calibração.', categories: ['Pulverização'] }
    }));

    assert.deepEqual(track, {
      id: track.id, title: 'Pulverização segura', description: 'EPI e calibração.', categories: ['Pulverização'], status: 'draft',
      tutors: [{ id: tutor.id, name: 'Tiago Tutor' }], workload_minutes: 0, module_count: 0, lesson_count: 0, published_at: null,
      is_tutor: true, updated_at: NOW, modules: [], created_by: tutor.id, insertion_date: NOW
    });
    assert.equal((await t.tracks.findById(track.id))?.last_item_id, 0);
  });
});
