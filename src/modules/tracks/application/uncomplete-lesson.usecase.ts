import type { SystemUserRepository } from '#modules/system-users';
import { type Result, ok } from '#shared/domain/result';
import type { CertificateRepository } from '../domain/certificate';
import type { EnrollmentRepository } from '../domain/enrollment';
import type { TrackRepository } from '../domain/track';
import type { EnrolledTrack } from '../track.contract';
import { findLessonOfEnrollment } from './find-enrollment';
import { toEnrolledTrack } from './track-views';

export interface UncompleteLessonDeps {
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  certificates: CertificateRepository;
  systemUsers: SystemUserRepository;
}

// Desmarca a aula (para rever depois). Uma trilha já concluída continua concluída, e o
// certificado emitido continua válido.
export class UncompleteLessonUseCase {
  constructor(private readonly deps: UncompleteLessonDeps) {}

  async execute(input: { trackId: number; workerId: number; lessonId: number }): Promise<Result<EnrolledTrack>> {
    const found = await findLessonOfEnrollment(this.deps, input);
    if (!found.ok) return found;
    const { track, enrollment } = found.value;

    enrollment.completed_lesson_ids = enrollment.completed_lesson_ids.filter((id) => id !== input.lessonId);
    await this.deps.enrollments.update(enrollment);
    return ok(await toEnrolledTrack(this.deps, track, enrollment));
  }
}
