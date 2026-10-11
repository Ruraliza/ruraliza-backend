import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import { type TracksTestbed, asAdmin, asTutor, givenTrack, givenTutor, tracksTestbed } from '../testing/track-fixtures';
import { UpdateTrackUseCase } from './update-track.usecase';

describe('UpdateTrackUseCase', () => {
  let t: TracksTestbed;
  let update: UpdateTrackUseCase;

  beforeEach(() => {
    t = tracksTestbed();
    update = new UpdateTrackUseCase(t);
  });

  it('o tutor edita os dados e adiciona outro tutor', async () => {
    const tiago = await givenTutor(t);
    const bia = await givenTutor(t, 'Bia Tutora');
    const track = await givenTrack(t, tiago.id);
    t.setNow('2026-10-02T09:00:00.000Z');

    const updated = unwrap(await update.execute({
      actor: asTutor(tiago.id), trackId: track.id, changes: { title: 'Café: colheita', categories: ['Colheita', 'Manutenção'], tutor_ids: [tiago.id, bia.id, bia.id] }
    }));

    assert.equal(updated.title, 'Café: colheita');
    assert.deepEqual(updated.categories, ['Colheita', 'Manutenção']);
    assert.deepEqual(updated.tutors.map((x) => x.name), ['Tiago Tutor', 'Bia Tutora']);
    assert.equal(updated.updated_at, '2026-10-02T09:00:00.000Z');
  });

  it('quem não é tutor da trilha recebe forbidden; trilha inexistente, not_found', async () => {
    const tiago = await givenTutor(t);
    const bia = await givenTutor(t, 'Bia Tutora');
    const track = await givenTrack(t, tiago.id);

    const other = await update.execute({ actor: asTutor(bia.id), trackId: track.id, changes: { title: 'X' } });
    assert.equal(other.ok ? 'ok' : other.kind, 'forbidden');
    const missing = await update.execute({ actor: asTutor(tiago.id), trackId: 99, changes: { title: 'X' } });
    assert.equal(missing.ok ? 'ok' : missing.kind, 'not_found');
    assert.equal((await t.tracks.findById(track.id))?.title, 'Colheita de café');
  });

  it('tutores precisam ter cargo tutor, e a lista não pode ficar vazia', async () => {
    const tiago = await givenTutor(t);
    const admin = await givenTutor(t, 'Ana Admin', 'admin');
    const track = await givenTrack(t, tiago.id);

    for (const tutor_ids of [[], [tiago.id, admin.id], [tiago.id, 99]]) {
      const result = await update.execute({ actor: asTutor(tiago.id), trackId: track.id, changes: { tutor_ids } });
      assert.equal(result.ok ? 'ok' : result.kind, 'invalid', JSON.stringify(tutor_ids));
    }
  });

  it('o administrador edita qualquer trilha, inclusive os tutores', async () => {
    const tiago = await givenTutor(t);
    const bia = await givenTutor(t, 'Bia Tutora');
    const admin = await givenTutor(t, 'Ana Admin', 'admin');
    const track = await givenTrack(t, tiago.id);

    const updated = unwrap(await update.execute({ actor: asAdmin(admin.id), trackId: track.id, changes: { title: 'Café', tutor_ids: [bia.id] } }));

    assert.deepEqual([updated.title, updated.tutors.map((x) => x.name), updated.is_tutor, updated.can_edit], ['Café', ['Bia Tutora'], false, true]);
  });
});
