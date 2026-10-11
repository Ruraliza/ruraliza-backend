import type { SystemUserRepository } from '#modules/system-users';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, ok } from '#shared/domain/result';
import { TRACK_STATUS, type TrackActor, type TrackRepository, canTransition, publishProblem } from '../domain/track';
import type { ManagedTrack, TrackStatusInput } from '../track.contract';
import { findEditableTrack } from './find-track';
import { toManagedTrack, tutorNames } from './track-views';

export interface ChangeTrackStatusDeps {
  tracks: TrackRepository;
  systemUsers: SystemUserRepository;
  clock: Clock;
}

const STATUS_LABEL = { draft: 'rascunho', published: 'publicada', discontinued: 'descontinuada' } as const;

// Publicar, descontinuar ou reativar. Trilha não se remove: descontinuada some da lista dos
// trabalhadores, mas quem já começou continua até o certificado.
export class ChangeTrackStatusUseCase {
  constructor(private readonly deps: ChangeTrackStatusDeps) {}

  async execute({ actor, trackId, status }: { actor: TrackActor; trackId: number; status: TrackStatusInput['status'] }): Promise<Result<ManagedTrack>> {
    const found = await findEditableTrack(this.deps.tracks, trackId, actor);
    if (!found.ok) return found;
    const track = found.value;

    if (!canTransition(track.status, status)) {
      return conflict(`Uma trilha ${STATUS_LABEL[track.status]} não pode ficar ${STATUS_LABEL[status]}.`);
    }
    if (status === TRACK_STATUS.PUBLISHED) {
      const problem = publishProblem(track.modules);
      if (problem) return conflict(problem);
    }

    const now = this.deps.clock.now();
    track.status = status;
    if (status === TRACK_STATUS.PUBLISHED && track.published_at === null) track.published_at = now;
    track.updated_at = now;
    await this.deps.tracks.update(track);
    return ok(toManagedTrack(track, await tutorNames(this.deps.systemUsers), actor));
  }
}
