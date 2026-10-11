import type { SystemUserRepository } from '#modules/system-users';
import { type Result, notFound, ok } from '#shared/domain/result';
import { TRACK_NOT_FOUND, type TrackActor, type TrackRepository } from '../domain/track';
import type { ManagedTrack } from '../track.contract';
import { toManagedTrack, tutorNames } from './track-views';

// Qualquer tutor vê qualquer trilha (completa); `is_tutor` diz se ele pode editar.
export class GetManagedTrackUseCase {
  constructor(private readonly deps: { tracks: TrackRepository; systemUsers: SystemUserRepository }) {}

  async execute({ actor, trackId }: { actor: TrackActor; trackId: number }): Promise<Result<ManagedTrack>> {
    const track = await this.deps.tracks.findById(trackId);
    if (!track) return notFound(TRACK_NOT_FOUND);
    return ok(toManagedTrack(track, await tutorNames(this.deps.systemUsers), actor));
  }
}
