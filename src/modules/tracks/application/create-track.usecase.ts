import type { SystemUserRepository } from '#modules/system-users';
import type { Clock } from '#shared/domain/clock';
import { type Result, ok } from '#shared/domain/result';
import { TRACK_STATUS, type TrackRepository } from '../domain/track';
import type { ManagedTrack, TrackInput } from '../track.contract';
import { toManagedTrack, tutorNames } from './track-views';

export interface CreateTrackDeps {
  tracks: TrackRepository;
  systemUsers: SystemUserRepository;
  clock: Clock;
}

// Cria a trilha em rascunho, sem conteúdo, com quem criou como tutor.
export class CreateTrackUseCase {
  constructor(private readonly deps: CreateTrackDeps) {}

  async execute({ actorId, input }: { actorId: number; input: TrackInput }): Promise<Result<ManagedTrack>> {
    const now = this.deps.clock.now();
    const track = await this.deps.tracks.create({
      title: input.title,
      description: input.description,
      categories: input.categories,
      tutor_ids: [actorId],
      status: TRACK_STATUS.DRAFT,
      modules: [],
      last_item_id: 0,
      created_by: actorId,
      insertion_date: now,
      updated_at: now,
      published_at: null
    });
    return ok(toManagedTrack(track, await tutorNames(this.deps.systemUsers), actorId));
  }
}
