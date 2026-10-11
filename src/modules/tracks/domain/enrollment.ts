import type { Repository } from '#shared/domain/repository';
import type { TrackProgress } from '../track.contract';
import { type TrackRecord, allLessons } from './track';

// Matrícula de um trabalhador numa trilha, com as aulas que ele já concluiu.
// TODO(db): tabela `enrollments` com UNIQUE (track_id, worker_id).
export interface EnrollmentRecord {
  id: number;
  track_id: number;
  worker_id: number;
  completed_lesson_ids: number[];
  last_lesson_id: number | null;
  started_at: string;
  completed_at: string | null;
}

export type EnrollmentRepository = Repository<EnrollmentRecord, 'track_id' | 'worker_id'>;

export const NOT_ENROLLED = 'Você ainda não começou esta trilha.';

export async function findEnrollment(enrollments: EnrollmentRepository, trackId: number, workerId: number): Promise<EnrollmentRecord | undefined> {
  const [found] = await enrollments.find({ track_id: trackId, worker_id: workerId });
  return found;
}

// Aulas concluídas que ainda existem na trilha (uma aula removida pelo tutor deixa de contar).
export function currentCompleted(track: TrackRecord, enrollment: EnrollmentRecord): number[] {
  const done = new Set(enrollment.completed_lesson_ids);
  return allLessons(track).filter((lesson) => done.has(lesson.id)).map((lesson) => lesson.id);
}

export function progressOf(track: TrackRecord, enrollment: EnrollmentRecord): TrackProgress {
  const total = allLessons(track).length;
  const completed = currentCompleted(track, enrollment).length;
  return {
    completed_lessons: completed,
    total_lessons: total,
    percent: total === 0 ? 0 : Math.floor((completed / total) * 100),
    last_lesson_id: enrollment.last_lesson_id,
    started_at: enrollment.started_at,
    completed_at: enrollment.completed_at
  };
}
