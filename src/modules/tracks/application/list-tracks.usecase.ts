import type { SystemUserRepository } from '#modules/system-users';
import { searchable } from '#shared/utils/search';
import { type EnrollmentRepository, progressOf } from '../domain/enrollment';
import { type TrackRepository, isOpenTo } from '../domain/track';
import type { TrackFilters, WorkerTrackSummary } from '../track.contract';
import { toTrackSummary, tutorNames } from './track-views';

export interface ListTracksDeps {
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  systemUsers: SystemUserRepository;
}

// Trilhas para os trabalhadores: as publicadas e, para quem envia `worker_id`, também as
// descontinuadas em que ele já está matriculado (com o progresso). Filtros combinados (E).
// Ordem: em andamento primeiro, depois as mais recentes.
// TODO(db): filtros em WHERE; a busca vira unaccent + ILIKE.
export class ListTracksUseCase {
  constructor(private readonly deps: ListTracksDeps) {}

  async execute(filters: TrackFilters = {}): Promise<WorkerTrackSummary[]> {
    const enrollments = filters.worker_id === undefined ? [] : await this.deps.enrollments.find({ worker_id: filters.worker_id });
    const byTrack = new Map(enrollments.map((e) => [e.track_id, e]));
    const names = await tutorNames(this.deps.systemUsers);
    const terms = searchable(filters.q ?? '').split(/\s+/).filter(Boolean);

    const list = (await this.deps.tracks.find())
      .filter((track) => isOpenTo(track, byTrack.has(track.id)))
      .filter((track) => filters.category === undefined || track.categories.includes(filters.category))
      .filter((track) => {
        if (terms.length === 0) return true;
        const haystack = searchable([track.title, track.description, ...track.categories].join(' '));
        return terms.every((term) => haystack.includes(term));
      })
      .map((track): WorkerTrackSummary => {
        const enrollment = byTrack.get(track.id);
        return { ...toTrackSummary(track, names), progress: enrollment ? progressOf(track, enrollment) : null };
      });

    const inProgress = (t: WorkerTrackSummary): number => (t.progress !== null && t.progress.completed_at === null ? 0 : 1);
    return list.sort((a, b) => inProgress(a) - inProgress(b) || (b.published_at ?? '').localeCompare(a.published_at ?? '') || b.id - a.id);
  }
}
