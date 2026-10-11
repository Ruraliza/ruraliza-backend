import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { unwrap } from '#shared/testing/unwrap';
import type { TrackRecord } from '../domain/track';
import { NOW, type TracksTestbed, givenTrack, givenTutor, givenWorker, tracksTestbed } from '../testing/track-fixtures';
import { CompleteLessonUseCase } from './complete-lesson.usecase';
import { GetCertificateUseCase } from './get-certificate.usecase';
import { GetEnrolledTrackUseCase } from './get-enrolled-track.usecase';
import { UncompleteLessonUseCase } from './uncomplete-lesson.usecase';

describe('conclusão das aulas e certificado', () => {
  let t: TracksTestbed;
  let complete: CompleteLessonUseCase;
  let uncomplete: UncompleteLessonUseCase;
  let track: TrackRecord;
  let workerId: number;

  beforeEach(async () => {
    t = tracksTestbed();
    complete = new CompleteLessonUseCase(t);
    uncomplete = new UncompleteLessonUseCase(t);
    track = await givenTrack(t, (await givenTutor(t)).id);
    workerId = (await givenWorker(t)).id;
    await t.enrollments.create({ track_id: track.id, worker_id: workerId, completed_lesson_ids: [], last_lesson_id: null, started_at: NOW, completed_at: null });
  });

  const done = (lessonId: number): ReturnType<CompleteLessonUseCase['execute']> => complete.execute({ trackId: track.id, workerId, lessonId });

  it('marca o progresso; repetir não conta duas vezes', async () => {
    unwrap(await done(3));
    const again = unwrap(await done(3));

    assert.deepEqual(again.track.completed_lesson_ids, [3]);
    assert.deepEqual([again.track.progress.percent, again.track.progress.last_lesson_id], [33, 3]);
    assert.equal(again.issued_certificate, null);
  });

  it('a última aula conclui a trilha e emite o certificado uma vez, com os dados do momento', async () => {
    unwrap(await done(2));
    unwrap(await done(5));
    t.setNow('2026-10-03T18:00:00.000Z');
    const last = unwrap(await done(3));

    const certificate = {
      code: 'RZ-TEST-0001', track_id: track.id, track_title: 'Colheita de café', worker_name: 'Maria Trabalhadora',
      workload_minutes: 60, completed_at: '2026-10-03T18:00:00.000Z'
    };
    assert.deepEqual(last.issued_certificate, certificate);
    assert.deepEqual([last.track.progress.completed_at, last.track.certificate_code], ['2026-10-03T18:00:00.000Z', 'RZ-TEST-0001']);

    // Desmarcar e concluir de novo não emite outro, e o certificado não muda com a trilha.
    unwrap(await uncomplete.execute({ trackId: track.id, workerId, lessonId: 3 }));
    assert.equal(unwrap(await done(3)).issued_certificate, null);
    await t.tracks.update({ ...track, title: 'Outro nome' });
    assert.deepEqual(unwrap(await new GetCertificateUseCase(t).execute({ code: ' rz-test-0001 ' })), certificate);
    assert.equal((await t.certificates.find()).length, 1);
  });

  it('desmarcar não tira a conclusão nem o certificado', async () => {
    for (const id of [2, 3, 5]) unwrap(await done(id));

    const undone = unwrap(await uncomplete.execute({ trackId: track.id, workerId, lessonId: 5 }));

    assert.deepEqual(undone.completed_lesson_ids, [2, 3]);
    assert.notEqual(undone.progress.completed_at, null);
    assert.equal(undone.certificate_code, 'RZ-TEST-0001');
  });

  it('aula removida pelo tutor deixa de contar; a trilha descontinuada continua para quem está matriculado', async () => {
    unwrap(await done(5));
    await t.tracks.update({ ...track, status: 'discontinued', modules: [{ id: 1, title: 'Preparação', lessons: [] }, { id: 4, title: 'Na lavoura', lessons: [{ id: 6, title: 'Nova', video_url: null, content: 'x', duration_minutes: 5 }] }] });

    const enrolled = unwrap(await new GetEnrolledTrackUseCase(t).execute({ trackId: track.id, workerId }));
    assert.deepEqual([enrolled.completed_lesson_ids, enrolled.progress.total_lessons], [[], 1]);
    assert.notEqual(unwrap(await done(6)).issued_certificate, null);
  });

  it('quem não está matriculado não estuda; aula de fora da trilha dá not_found', async () => {
    const stranger = await complete.execute({ trackId: track.id, workerId: 99, lessonId: 2 });
    assert.equal(stranger.ok ? 'ok' : stranger.kind, 'forbidden');
    const notLesson = await done(1); // 1 é um módulo
    assert.equal(notLesson.ok ? 'ok' : notLesson.kind, 'not_found');
    const view = await new GetEnrolledTrackUseCase(t).execute({ trackId: track.id, workerId: 99 });
    assert.equal(view.ok ? 'ok' : view.kind, 'forbidden');
  });
});
