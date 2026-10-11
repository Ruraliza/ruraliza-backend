import type { Repository } from '#shared/domain/repository';
import type { Lesson, TrackModule, TrackStatus } from '../track.contract';

// Trilha como fica guardada: o agregado com os módulos e as aulas dentro (como as fotos em Farm).
// TODO(db): tabelas `tracks`, `track_modules` e `lessons` (ou o conteúdo em JSONB), e `track_tutors`.
export interface TrackRecord {
  id: number;
  title: string;
  description: string;
  categories: string[];
  tutor_ids: number[];
  status: TrackStatus;
  modules: TrackModule[];
  // Último id dado a um módulo ou aula. Ids nunca são reaproveitados: o progresso de quem já
  // estudou não pode apontar para outra aula depois que uma é removida.
  last_item_id: number;
  created_by: number;
  insertion_date: string;
  updated_at: string;
  published_at: string | null;
}

export type TrackRepository = Repository<TrackRecord, 'status'>;

export const TRACK_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  DISCONTINUED: 'discontinued'
} as const satisfies Record<string, TrackStatus>;

export const TRACK_NOT_FOUND = 'Trilha não encontrada.';
export const NOT_A_TUTOR = 'Só os tutores desta trilha podem editá-la.';

// Limites do conteúdo (o editor e a API usam os mesmos).
export const TRACK_LIMITS = {
  title: 120,
  description: 2000,
  categories: 7,
  tutors: 10,
  modules: 30,
  lessonsPerModule: 50,
  lessonContent: 20_000,
  minLessonMinutes: 1,
  maxLessonMinutes: 600
} as const;

const TRANSITIONS: Record<TrackStatus, readonly TrackStatus[]> = {
  draft: ['published'],
  published: ['discontinued'],
  discontinued: ['published']
};

// Não existe remoção nem volta para rascunho: publicada só pode ser descontinuada (e reativada).
export function canTransition(from: TrackStatus, to: TrackStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// Para publicar (ou continuar publicada): ao menos um módulo, e nenhum módulo vazio.
export function publishProblem(modules: readonly TrackModule[]): string | null {
  if (modules.length === 0) return 'A trilha precisa de pelo menos um módulo com uma aula.';
  const empty = modules.find((m) => m.lessons.length === 0);
  return empty ? `O módulo "${empty.title}" não tem aulas.` : null;
}

export function isTutorOf(track: TrackRecord, systemUserId: number): boolean {
  return track.tutor_ids.includes(systemUserId);
}

export function allLessons(track: { modules: readonly TrackModule[] }): Lesson[] {
  return track.modules.flatMap((m) => m.lessons);
}

export function workloadMinutes(track: { modules: readonly TrackModule[] }): number {
  return allLessons(track).reduce((sum, lesson) => sum + lesson.duration_minutes, 0);
}

// Visível para os trabalhadores: publicada, ou descontinuada para quem já está matriculado.
export function isOpenTo(track: TrackRecord, enrolled: boolean): boolean {
  return track.status === TRACK_STATUS.PUBLISHED || (track.status === TRACK_STATUS.DISCONTINUED && enrolled);
}
