import type { SystemUserRepository } from '#modules/system-users';
import type { TrackRepository } from '../domain/track';
import type { ManagedTrackSummary } from '../track.contract';
import { toManagedSummary, tutorNames } from './track-views';

// Todas as trilhas, em qualquer status, as editadas mais recentemente primeiro.
export class ListManagedTracksUseCase {
  constructor(private readonly deps: { tracks: TrackRepository; systemUsers: SystemUserRepository }) {}

  async execute({ actorId }: { actorId: number }): Promise<ManagedTrackSummary[]> {
    const names = await tutorNames(this.deps.systemUsers);
    return (await this.deps.tracks.find())
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)
      .map((track) => toManagedSummary(track, names, actorId));
  }
}
