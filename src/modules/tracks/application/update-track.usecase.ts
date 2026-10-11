import type { SystemUserRepository } from '#modules/system-users';
import type { Clock } from '#shared/domain/clock';
import { type Result, ok } from '#shared/domain/result';
import type { TrackActor, TrackRepository } from '../domain/track';
import type { ManagedTrack, TrackUpdate } from '../track.contract';
import { checkTutors } from './check-tutors';
import { findEditableTrack } from './find-track';
import { toManagedTrack, tutorNames } from './track-views';

export interface UpdateTrackDeps {
  tracks: TrackRepository;
  systemUsers: SystemUserRepository;
  clock: Clock;
}

// Título, descrição, categorias e tutores. Só um tutor da trilha edita (e pode se retirar dela).
export class UpdateTrackUseCase {
  constructor(private readonly deps: UpdateTrackDeps) {}

  async execute({ actor, trackId, changes }: { actor: TrackActor; trackId: number; changes: TrackUpdate }): Promise<Result<ManagedTrack>> {
    const found = await findEditableTrack(this.deps.tracks, trackId, actor);
    if (!found.ok) return found;
    const track = found.value;

    if (changes.tutor_ids !== undefined) {
      const tutors = await checkTutors(this.deps.systemUsers, changes.tutor_ids);
      if (!tutors.ok) return tutors;
      track.tutor_ids = tutors.value;
    }
    if (changes.title !== undefined) track.title = changes.title;
    if (changes.description !== undefined) track.description = changes.description;
    if (changes.categories !== undefined) track.categories = changes.categories;
    track.updated_at = this.deps.clock.now();
    await this.deps.tracks.update(track);
    return ok(toManagedTrack(track, await tutorNames(this.deps.systemUsers), actor));
  }
}
