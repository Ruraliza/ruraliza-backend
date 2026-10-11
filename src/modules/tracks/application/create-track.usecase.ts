import type { SystemUserRepository } from '#modules/system-users';
import type { Clock } from '#shared/domain/clock';
import { type Result, invalid, ok } from '#shared/domain/result';
import { TRACK_STATUS, type TrackActor, type TrackRepository } from '../domain/track';
import type { ManagedTrack, TrackInput } from '../track.contract';
import { checkTutors } from './check-tutors';
import { toManagedTrack, tutorNames } from './track-views';

export interface CreateTrackDeps {
  tracks: TrackRepository;
  systemUsers: SystemUserRepository;
  clock: Clock;
}

// Cria a trilha em rascunho, sem conteúdo. O tutor que cria vira tutor dela (com os colegas que
// indicar); o administrador não é tutor, então escolhe os tutores responsáveis (ao menos um).
export class CreateTrackUseCase {
  constructor(private readonly deps: CreateTrackDeps) {}

  async execute({ actor, input }: { actor: TrackActor; input: TrackInput }): Promise<Result<ManagedTrack>> {
    const actorIsTutor = (await this.deps.systemUsers.findById(actor.id))?.role === 'tutor';
    const requested = input.tutor_ids ?? [];
    if (!actorIsTutor && requested.length === 0) return invalid('Escolha pelo menos um tutor para a trilha.');

    const tutors = await checkTutors(this.deps.systemUsers, actorIsTutor ? [actor.id, ...requested] : requested);
    if (!tutors.ok) return tutors;

    const now = this.deps.clock.now();
    const track = await this.deps.tracks.create({
      title: input.title,
      description: input.description,
      categories: input.categories,
      tutor_ids: tutors.value,
      status: TRACK_STATUS.DRAFT,
      modules: [],
      last_item_id: 0,
      created_by: actor.id,
      insertion_date: now,
      updated_at: now,
      published_at: null
    });
    return ok(toManagedTrack(track, await tutorNames(this.deps.systemUsers), actor));
  }
}
