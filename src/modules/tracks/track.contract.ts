import type { MessageResponse } from '#shared/contracts/api';

// Trilhas de estudo: cursos para os trabalhadores, divididos em módulos e aulas, criados e editados
// pelos tutores (usuários de sistema com cargo `tutor`). Uma trilha nunca é removida: no máximo é
// descontinuada (some da lista, mas quem já começou termina e recebe o certificado).

// draft → published ⇄ discontinued (nunca volta para draft).
export type TrackStatus = 'draft' | 'published' | 'discontinued';

export interface TrackTutor {
  id: number; // usuário de sistema
  name: string;
}

export interface Lesson {
  id: number; // único dentro da trilha
  title: string;
  video_url: string | null; // YouTube ou Vimeo, no formato canônico (https://www.youtube.com/watch?v=… ou https://vimeo.com/…)
  content: string; // texto em Markdown simples
  duration_minutes: number;
}

export interface TrackModule {
  id: number; // único dentro da trilha
  title: string;
  lessons: Lesson[]; // na ordem de estudo
}

// Aula no sumário mostrado antes de começar (sem o conteúdo).
export interface LessonOutline {
  id: number;
  title: string;
  duration_minutes: number;
  has_video: boolean;
}

export interface TrackModuleOutline {
  id: number;
  title: string;
  lessons: LessonOutline[];
}

// Progresso de um trabalhador matriculado.
export interface TrackProgress {
  completed_lessons: number;
  total_lessons: number;
  percent: number; // 0 a 100, inteiro
  last_lesson_id: number | null; // a última aula marcada como concluída
  started_at: string;
  completed_at: string | null; // quando concluiu todas as aulas (e ganhou o certificado)
}

// O que aparece nos cards das listas.
export interface TrackSummary {
  id: number;
  title: string;
  description: string;
  categories: string[]; // categorias de serviço (GET /api/categories)
  status: TrackStatus;
  tutors: TrackTutor[];
  workload_minutes: number; // soma das durações das aulas (carga horária)
  module_count: number;
  lesson_count: number;
  published_at: string | null;
}

// GET /workers/tracks: trilhas publicadas e as descontinuadas em que o trabalhador está matriculado.
export interface WorkerTrackSummary extends TrackSummary {
  progress: TrackProgress | null; // null = não começou (ou `worker_id` não enviado)
}

// GET /workers/tracks/:id: a página da trilha antes de começar.
export interface TrackDetail extends WorkerTrackSummary {
  modules: TrackModuleOutline[];
}

// GET /workers/:id/tracks/:trackId: a trilha completa, só para quem está matriculado.
export interface EnrolledTrack extends TrackSummary {
  modules: TrackModule[];
  progress: TrackProgress;
  completed_lesson_ids: number[];
  certificate_code: string | null;
}

// GET /admin/tracks: lista dos tutores e do administrador (todas as trilhas, em qualquer status).
export interface ManagedTrackSummary extends TrackSummary {
  is_tutor: boolean; // quem pediu é tutor desta trilha
  can_edit: boolean; // quem pediu pode editar: tutor da trilha ou administrador
  updated_at: string;
}

// GET /admin/tracks/:id
export interface ManagedTrack extends ManagedTrackSummary {
  modules: TrackModule[];
  created_by: number;
  insertion_date: string;
}

// POST /admin/tracks. O tutor que cria vira tutor da trilha (mais os `tutor_ids` que indicar);
// o administrador precisa indicar ao menos um tutor.
export interface TrackInput {
  title: string;
  description: string;
  categories: string[];
  tutor_ids?: number[];
}

// PATCH /admin/tracks/:id
export interface TrackUpdate {
  title?: string;
  description?: string;
  categories?: string[];
  tutor_ids?: number[]; // usuários de sistema com cargo tutor; ao menos um
}

// PUT /admin/tracks/:id/content: substitui módulos e aulas de uma vez. Com `id`, o item existente
// é mantido (o progresso dos alunos continua valendo); sem `id`, é um item novo.
export interface LessonInput {
  id?: number;
  title: string;
  video_url?: string | null;
  content?: string;
  duration_minutes: number;
}

export interface TrackModuleInput {
  id?: number;
  title: string;
  lessons: LessonInput[];
}

export interface TrackContentInput {
  modules: TrackModuleInput[];
}

// PATCH /admin/tracks/:id/status
export interface TrackStatusInput {
  status: Exclude<TrackStatus, 'draft'>;
}

export interface ManagedTrackResponse extends MessageResponse {
  track: ManagedTrack;
}

// GET /workers/tracks
export interface TrackFilters {
  q?: string;
  category?: string;
  worker_id?: number;
}

// POST /workers/tracks/:id/enroll
export interface EnrollInput {
  worker_id: number;
}

export interface EnrolledTrackResponse extends MessageResponse {
  track: EnrolledTrack;
}

// PUT / DELETE /workers/:id/tracks/:trackId/lessons/:lessonId/completion
export interface LessonCompletionResponse extends EnrolledTrackResponse {
  issued_certificate: Certificate | null; // o certificado emitido por esta conclusão (só na última aula)
}

// Certificado de conclusão em nome da Ruraliza. Guarda os dados de quando foi emitido:
// mudanças posteriores na trilha ou no nome não alteram um certificado já emitido.
export interface Certificate {
  code: string; // código de validação (GET /api/certificates/:code)
  track_id: number;
  track_title: string;
  worker_name: string;
  workload_minutes: number;
  completed_at: string;
}
