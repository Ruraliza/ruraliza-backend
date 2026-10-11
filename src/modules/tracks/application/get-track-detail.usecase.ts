import type { SystemUserRepository } from '#modules/system-users';
import { type Result, notFound, ok } from '#shared/domain/result';
import { type EnrollmentRepository, findEnrollment } from '../domain/enrollment';
import { TRACK_NOT_FOUND, type TrackRepository, isOpenTo } from '../domain/track';
import type { TrackDetail } from '../track.contract';
import { toTrackDetail, tutorNames } from './track-views';

export interface GetTrackDetailDeps {
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  systemUsers: SystemUserRepository;
}

// A página da trilha antes de começar: descrição, tutores, carga horária e o sumário (sem o
// conteúdo das aulas). Rascunho não existe para o trabalhador; descontinuada, só para quem já começou.
export class GetTrackDetailUseCase {
  constructor(private readonly deps: GetTrackDetailDeps) {}

  async execute({ trackId, workerId }: { trackId: number; workerId?: number | undefined }): Promise<Result<TrackDetail>> {
    const track = await this.deps.tracks.findById(trackId);
    const enrollment = track && workerId !== undefined ? await findEnrollment(this.deps.enrollments, track.id, workerId) : undefined;
    if (!track || !isOpenTo(track, enrollment !== undefined)) return notFound(TRACK_NOT_FOUND);
    return ok(toTrackDetail(track, await tutorNames(this.deps.systemUsers), enrollment));
  }
}
