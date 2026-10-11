import type { SystemUserRepository } from '#modules/system-users';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, invalid, ok } from '#shared/domain/result';
import { TRACK_STATUS, type TrackRecord, type TrackRepository, allLessons, publishProblem } from '../domain/track';
import type { Lesson, ManagedTrack, TrackContentInput, TrackModule } from '../track.contract';
import { findEditableTrack } from './find-track';
import { toManagedTrack, tutorNames } from './track-views';

export interface SaveTrackContentDeps {
  tracks: TrackRepository;
  systemUsers: SystemUserRepository;
  clock: Clock;
}

// Monta a nova árvore: itens com `id` precisam existir na trilha (uma aula pode mudar de módulo);
// itens sem `id` ganham um id novo, a partir de `last_item_id`.
function buildModules(track: TrackRecord, content: TrackContentInput): Result<{ modules: TrackModule[]; lastId: number }> {
  const moduleIds = new Set(track.modules.map((m) => m.id));
  const lessonIds = new Set(allLessons(track).map((l) => l.id));
  const used = new Set<number>();
  let lastId = track.last_item_id;

  const take = (id: number | undefined, known: Set<number>, what: string): Result<number> => {
    if (id === undefined) return ok((lastId += 1));
    if (!known.has(id)) return invalid(`${what} ${id} não existe nesta trilha.`);
    if (used.has(id)) return invalid(`${what} ${id} aparece mais de uma vez.`);
    used.add(id);
    return ok(id);
  };

  const modules: TrackModule[] = [];
  for (const m of content.modules) {
    const moduleId = take(m.id, moduleIds, 'O módulo');
    if (!moduleId.ok) return moduleId;
    const lessons: Lesson[] = [];
    for (const l of m.lessons) {
      const lessonId = take(l.id, lessonIds, 'A aula');
      if (!lessonId.ok) return lessonId;
      lessons.push({ id: lessonId.value, title: l.title, video_url: l.video_url ?? null, content: l.content ?? '', duration_minutes: l.duration_minutes });
    }
    modules.push({ id: moduleId.value, title: m.title, lessons });
  }
  return ok({ modules, lastId });
}

// Substitui os módulos e as aulas de uma vez. Uma trilha no ar (publicada ou descontinuada)
// não pode ficar sem aula nem com módulo vazio.
export class SaveTrackContentUseCase {
  constructor(private readonly deps: SaveTrackContentDeps) {}

  async execute({ actorId, trackId, content }: { actorId: number; trackId: number; content: TrackContentInput }): Promise<Result<ManagedTrack>> {
    const found = await findEditableTrack(this.deps.tracks, trackId, actorId);
    if (!found.ok) return found;
    const track = found.value;

    const built = buildModules(track, content);
    if (!built.ok) return built;

    const problem = track.status === TRACK_STATUS.DRAFT ? null : publishProblem(built.value.modules);
    if (problem) return conflict(`A trilha já foi publicada: ${problem}`);

    track.modules = built.value.modules;
    track.last_item_id = built.value.lastId;
    track.updated_at = this.deps.clock.now();
    await this.deps.tracks.update(track);
    return ok(toManagedTrack(track, await tutorNames(this.deps.systemUsers), actorId));
  }
}
