// Trilhas de estudo de ponta a ponta pelo container: o tutor monta e publica, o trabalhador estuda
// e ganha o certificado, e a trilha descontinuada continua para quem já começou.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Container } from '../../src/container';
import { NOW, PASSWORD, setup, unwrap, worker } from './support';

async function tutor(c: Container, email: string, name: string): Promise<number> {
  return unwrap(await c.useCases.systemUsers.createSystemUser.execute({ email, name, role: 'tutor', password: PASSWORD })).id;
}

async function publishedTrack(c: Container, tutorId: number): Promise<{ trackId: number; lessonIds: number[] }> {
  const { tracks } = c.useCases;
  const draft = unwrap(await tracks.createTrack.execute({ actorId: tutorId, input: { title: 'Colheita de café', description: 'Do pé à saca.', categories: ['Colheita'] } }));
  const filled = unwrap(await tracks.saveTrackContent.execute({
    actorId: tutorId,
    trackId: draft.id,
    content: {
      modules: [
        { title: 'Antes', lessons: [{ title: 'Ponto', content: 'Cereja.', duration_minutes: 30 }, { title: 'EPI', video_url: 'https://youtu.be/dQw4w9WgXcQ', duration_minutes: 45 }] },
        { title: 'Na lavoura', lessons: [{ title: 'Derriça', content: 'No pano.', duration_minutes: 45 }] }
      ]
    }
  }));
  unwrap(await tracks.changeTrackStatus.execute({ actorId: tutorId, trackId: draft.id, status: 'published' }));
  return { trackId: draft.id, lessonIds: filled.modules.flatMap((m) => m.lessons.map((l) => l.id)) };
}

describe('trilhas de estudo', () => {
  it('tutor publica, trabalhador conclui e recebe o certificado com nome, carga horária e data', async () => {
    const c = setup();
    const tiago = await tutor(c, 'tiago@exemplo.com', 'Tiago Tutor');
    const { trackId, lessonIds } = await publishedTrack(c, tiago);
    const maria = await worker(c, 'maria@exemplo.com', '11144477735');
    const { tracks } = c.useCases;

    const [listed] = await tracks.listTracks.execute({ category: 'Colheita', worker_id: maria });
    assert.deepEqual([listed?.workload_minutes, listed?.tutors.map((x) => x.name), listed?.progress], [120, ['Tiago Tutor'], null]);

    unwrap(await tracks.enroll.execute({ trackId, workerId: maria }));
    let certificate = null;
    for (const lessonId of lessonIds) certificate = unwrap(await tracks.completeLesson.execute({ trackId, workerId: maria, lessonId })).issued_certificate;

    assert.ok(certificate);
    assert.deepEqual(
      { ...certificate, code: undefined },
      { code: undefined, track_id: trackId, track_title: 'Colheita de café', worker_name: 'maria@exemplo.com', workload_minutes: 120, completed_at: NOW }
    );
    assert.match(certificate.code, /^RZ-/);
    assert.deepEqual(unwrap(await tracks.getCertificate.execute({ code: certificate.code })), certificate);
    assert.deepEqual(await tracks.listCertificates.execute({ workerId: maria }), [certificate]);
  });

  it('descontinuada: some para quem não começou, não aceita aluno novo, mas o aluno termina', async () => {
    const c = setup();
    const tiago = await tutor(c, 'tiago@exemplo.com', 'Tiago Tutor');
    const { trackId, lessonIds } = await publishedTrack(c, tiago);
    const maria = await worker(c, 'maria@exemplo.com', '11144477735');
    const joao = await worker(c, 'joao@exemplo.com', '52998224725');
    const { tracks } = c.useCases;
    unwrap(await tracks.enroll.execute({ trackId, workerId: maria }));

    unwrap(await tracks.changeTrackStatus.execute({ actorId: tiago, trackId, status: 'discontinued' }));

    assert.deepEqual(await tracks.listTracks.execute({ worker_id: joao }), []);
    const closed = await tracks.enroll.execute({ trackId, workerId: joao });
    assert.equal(closed.ok ? 'ok' : closed.kind, 'conflict');
    assert.equal((await tracks.listTracks.execute({ worker_id: maria })).length, 1);
    let last = null;
    for (const lessonId of lessonIds) last = unwrap(await tracks.completeLesson.execute({ trackId, workerId: maria, lessonId }));
    assert.notEqual(last?.issued_certificate, null);
  });

  it('outro tutor vê a trilha, mas só edita depois de adicionado por um tutor dela', async () => {
    const c = setup();
    const tiago = await tutor(c, 'tiago@exemplo.com', 'Tiago Tutor');
    const bia = await tutor(c, 'bia@exemplo.com', 'Bia Tutora');
    const { trackId } = await publishedTrack(c, tiago);
    const { tracks } = c.useCases;

    assert.equal(unwrap(await tracks.getManagedTrack.execute({ actorId: bia, trackId })).is_tutor, false);
    const denied = await tracks.updateTrack.execute({ actorId: bia, trackId, changes: { title: 'X' } });
    assert.equal(denied.ok ? 'ok' : denied.kind, 'forbidden');

    unwrap(await tracks.updateTrack.execute({ actorId: tiago, trackId, changes: { tutor_ids: [tiago, bia] } }));
    assert.equal(unwrap(await tracks.updateTrack.execute({ actorId: bia, trackId, changes: { title: 'Café' } })).title, 'Café');
  });
});
