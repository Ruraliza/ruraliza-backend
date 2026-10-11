import type { SystemUserRepository } from '#modules/system-users';
import type { CertificateRepository } from '../domain/certificate';
import { type EnrollmentRecord, currentCompleted, progressOf } from '../domain/enrollment';
import { type TrackRecord, allLessons, isTutorOf, workloadMinutes } from '../domain/track';
import type { EnrolledTrack, ManagedTrack, ManagedTrackSummary, TrackDetail, TrackModuleOutline, TrackSummary, TrackTutor } from '../track.contract';

// Monta as respostas a partir do agregado. Os nomes dos tutores são relidos da equipe a cada
// leitura (quem mudou de nome aparece com o nome novo).

export type TutorNames = ReadonlyMap<number, string>;

export async function tutorNames(systemUsers: SystemUserRepository): Promise<TutorNames> {
  return new Map((await systemUsers.find()).map((user) => [user.id, user.name]));
}

function tutorsOf(track: TrackRecord, names: TutorNames): TrackTutor[] {
  return track.tutor_ids.flatMap((id) => {
    const name = names.get(id);
    return name === undefined ? [] : [{ id, name }];
  });
}

export function toTrackSummary(track: TrackRecord, names: TutorNames): TrackSummary {
  return {
    id: track.id,
    title: track.title,
    description: track.description,
    categories: [...track.categories],
    status: track.status,
    tutors: tutorsOf(track, names),
    workload_minutes: workloadMinutes(track),
    module_count: track.modules.length,
    lesson_count: allLessons(track).length,
    published_at: track.published_at
  };
}

export function toManagedSummary(track: TrackRecord, names: TutorNames, actorId: number): ManagedTrackSummary {
  return { ...toTrackSummary(track, names), is_tutor: isTutorOf(track, actorId), updated_at: track.updated_at };
}

export function toManagedTrack(track: TrackRecord, names: TutorNames, actorId: number): ManagedTrack {
  return { ...toManagedSummary(track, names, actorId), modules: track.modules, created_by: track.created_by, insertion_date: track.insertion_date };
}

// Sumário sem o conteúdo das aulas (a página antes de começar).
export function toTrackDetail(track: TrackRecord, names: TutorNames, enrollment: EnrollmentRecord | undefined): TrackDetail {
  const modules: TrackModuleOutline[] = track.modules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, duration_minutes: l.duration_minutes, has_video: l.video_url !== null }))
  }));
  return { ...toTrackSummary(track, names), progress: enrollment ? progressOf(track, enrollment) : null, modules };
}

export async function toEnrolledTrack(
  deps: { systemUsers: SystemUserRepository; certificates: CertificateRepository },
  track: TrackRecord,
  enrollment: EnrollmentRecord
): Promise<EnrolledTrack> {
  const [certificate] = await deps.certificates.find({ track_id: track.id, worker_id: enrollment.worker_id });
  return {
    ...toTrackSummary(track, await tutorNames(deps.systemUsers)),
    modules: track.modules,
    progress: progressOf(track, enrollment),
    completed_lesson_ids: currentCompleted(track, enrollment),
    certificate_code: certificate?.code ?? null
  };
}
