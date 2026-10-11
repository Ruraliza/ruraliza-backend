import type { SystemUserRepository } from '#modules/system-users';
import { type Result, forbidden, notFound, ok } from '#shared/domain/result';
import type { CertificateRepository } from '../domain/certificate';
import { type EnrollmentRepository, NOT_ENROLLED, findEnrollment } from '../domain/enrollment';
import { TRACK_NOT_FOUND, TRACK_STATUS, type TrackRepository } from '../domain/track';
import type { EnrolledTrack } from '../track.contract';
import { toEnrolledTrack } from './track-views';

export interface GetEnrolledTrackDeps {
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  certificates: CertificateRepository;
  systemUsers: SystemUserRepository;
}

// A trilha completa (com o conteúdo das aulas) e o progresso: só para quem está matriculado,
// mesmo que a trilha tenha sido descontinuada depois.
export class GetEnrolledTrackUseCase {
  constructor(private readonly deps: GetEnrolledTrackDeps) {}

  async execute({ trackId, workerId }: { trackId: number; workerId: number }): Promise<Result<EnrolledTrack>> {
    const track = await this.deps.tracks.findById(trackId);
    if (!track || track.status === TRACK_STATUS.DRAFT) return notFound(TRACK_NOT_FOUND);
    const enrollment = await findEnrollment(this.deps.enrollments, track.id, workerId);
    if (!enrollment) return forbidden(NOT_ENROLLED);
    return ok(await toEnrolledTrack(this.deps, track, enrollment));
  }
}
