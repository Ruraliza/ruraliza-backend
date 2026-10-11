import { type Result, forbidden, notFound, ok } from '#shared/domain/result';
import { type EnrollmentRecord, type EnrollmentRepository, NOT_ENROLLED, findEnrollment } from '../domain/enrollment';
import { TRACK_NOT_FOUND, TRACK_STATUS, type TrackRecord, type TrackRepository, allLessons } from '../domain/track';

export interface LessonOfEnrollment {
  track: TrackRecord;
  enrollment: EnrollmentRecord;
}

// A trilha, a matrícula do trabalhador e a confirmação de que a aula existe nela.
export async function findLessonOfEnrollment(
  deps: { tracks: TrackRepository; enrollments: EnrollmentRepository },
  { trackId, workerId, lessonId }: { trackId: number; workerId: number; lessonId: number }
): Promise<Result<LessonOfEnrollment>> {
  const track = await deps.tracks.findById(trackId);
  if (!track || track.status === TRACK_STATUS.DRAFT) return notFound(TRACK_NOT_FOUND);
  const enrollment = await findEnrollment(deps.enrollments, track.id, workerId);
  if (!enrollment) return forbidden(NOT_ENROLLED);
  if (!allLessons(track).some((lesson) => lesson.id === lessonId)) return notFound('Aula não encontrada nesta trilha.');
  return ok({ track, enrollment });
}
