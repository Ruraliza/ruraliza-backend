import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { NOW, type TracksTestbed, asAdmin, asTutor, givenTutor, tracksTestbed } from '../testing/track-fixtures';
import { CreateTrackUseCase } from './create-track.usecase';

const input = { title: 'Pulverização segura', description: 'EPI e calibração.', categories: ['Pulverização'] };

describe('CreateTrackUseCase', () => {
  let t: TracksTestbed;
  let create: CreateTrackUseCase;

  beforeEach(() => {
    t = tracksTestbed();
    create = new CreateTrackUseCase(t);
  });

  it('cria em rascunho, sem conteúdo, com quem criou como tutor', async () => {
    const tutor = await givenTutor(t);

    const track = unwrap(await create.execute({ actor: asTutor(tutor.id), input }));

    assert.deepEqual(track, {
      id: track.id, title: 'Pulverização segura', description: 'EPI e calibração.', categories: ['Pulverização'], status: 'draft',
      tutors: [{ id: tutor.id, name: 'Tiago Tutor' }], workload_minutes: 0, module_count: 0, lesson_count: 0, published_at: null,
      is_tutor: true, can_edit: true, updated_at: NOW, modules: [], created_by: tutor.id, insertion_date: NOW
    });
    assert.equal((await t.tracks.findById(track.id))?.last_item_id, 0);
  });

  it('o tutor pode chamar colegas na criação (ele continua tutor)', async () => {
    const tiago = await givenTutor(t);
    const bia = await givenTutor(t, 'Bia Tutora');

    const track = unwrap(await create.execute({ actor: asTutor(tiago.id), input: { ...input, tutor_ids: [bia.id, tiago.id] } }));

    assert.deepEqual(track.tutors.map((x) => x.name), ['Tiago Tutor', 'Bia Tutora']);
  });

  it('o administrador escolhe os tutores e não vira tutor', async () => {
    const admin = await givenTutor(t, 'Ana Admin', 'admin');
    const bia = await givenTutor(t, 'Bia Tutora');

    const track = unwrap(await create.execute({ actor: asAdmin(admin.id), input: { ...input, tutor_ids: [bia.id] } }));

    assert.deepEqual([track.tutors.map((x) => x.name), track.is_tutor, track.can_edit, track.created_by], [['Bia Tutora'], false, true, admin.id]);
  });

  it('o administrador precisa indicar ao menos um tutor de verdade', async () => {
    const admin = await givenTutor(t, 'Ana Admin', 'admin');

    for (const tutor_ids of [undefined, [], [admin.id]]) {
      const result = await create.execute({ actor: asAdmin(admin.id), input: tutor_ids === undefined ? input : { ...input, tutor_ids } });
      assert.equal(result.ok ? 'ok' : result.kind, 'invalid', JSON.stringify(tutor_ids));
    }
    assert.deepEqual(await t.tracks.find(), []);
  });
});
