import { CATEGORIES } from '#modules/services';
import { type Properties, type RefTo, type Schema, id, input, isoDate, object, refTo } from '#shared/infra/docs/schema-kit';
import { TRACK_LIMITS as LIMIT, TRACK_STATUS } from '../domain/track';

// Schemas OpenAPI das trilhas e certificados (contrato em ../track.contract.ts). Registrados em src/docs/schemas.ts.
export type TrackSchemaName =
  | 'TrackStatus' | 'TrackTutor' | 'Lesson' | 'TrackModule' | 'LessonOutline' | 'TrackModuleOutline' | 'TrackProgress'
  | 'WorkerTrackSummary' | 'TrackDetail' | 'EnrolledTrack' | 'ManagedTrackSummary' | 'ManagedTrack'
  | 'TrackInput' | 'TrackUpdate' | 'TrackContentInput' | 'TrackStatusInput' | 'EnrollInput'
  | 'ManagedTrackResponse' | 'EnrolledTrackResponse' | 'LessonCompletionResponse' | 'Certificate';

const ref: RefTo<TrackSchemaName> = refTo;

const title: Schema = { type: 'string', maxLength: LIMIT.title, example: 'Colheita de café do pé à saca' };
const description: Schema = { type: 'string', maxLength: LIMIT.description, example: 'Do ponto de colheita à secagem: técnicas, segurança e cuidados com o grão.' };
const categories: Schema = {
  type: 'array',
  minItems: 1,
  items: { type: 'string', enum: [...CATEGORIES] },
  example: ['Colheita'],
  description: 'Categorias de serviço (GET /api/categories).'
};
const minutes: Schema = { type: 'integer', minimum: LIMIT.minLessonMinutes, maximum: LIMIT.maxLessonMinutes, example: 15, description: 'Minutos.' };
const videoUrl: Schema = {
  type: 'string',
  nullable: true,
  example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  description: 'YouTube ou Vimeo, no formato canônico. null = aula só de texto.'
};
const content: Schema = { type: 'string', maxLength: LIMIT.lessonContent, example: '## Ponto de colheita\n\nColha quando **80%** dos grãos estiverem cereja.' };
const count: Schema = { type: 'integer', minimum: 0, example: 6 };
const nullableDate: Schema = { ...isoDate, nullable: true };

const summaryProps: Properties = {
  id,
  title,
  description,
  categories,
  status: ref('TrackStatus'),
  tutors: { type: 'array', items: ref('TrackTutor') },
  workload_minutes: { type: 'integer', minimum: 0, example: 90, description: 'Carga horária: soma das durações das aulas.' },
  module_count: count,
  lesson_count: count,
  published_at: nullableDate
};
const summaryRequired = Object.keys(summaryProps);
const managedSummaryProps: Properties = {
  ...summaryProps,
  is_tutor: { type: 'boolean', description: 'Quem pediu é tutor desta trilha.' },
  can_edit: { type: 'boolean', description: 'Quem pediu pode editar: tutor da trilha ou administrador.' },
  updated_at: isoDate
};
const enrolledProps: Properties = {
  ...summaryProps,
  modules: { type: 'array', items: ref('TrackModule') },
  progress: ref('TrackProgress'),
  completed_lesson_ids: { type: 'array', items: id },
  certificate_code: { type: 'string', nullable: true, example: 'RZ-7K3Q-9FMA-2X' }
};
// Também aparecem como `nullable` dentro de outros schemas ($ref + nullable não aceita null).
const progressSchema: Schema = object(
  {
    completed_lessons: count,
    total_lessons: count,
    percent: { type: 'integer', minimum: 0, maximum: 100, example: 50 },
    last_lesson_id: { ...id, nullable: true, description: 'A última aula marcada como concluída.' },
    started_at: isoDate,
    completed_at: { ...nullableDate, description: 'Quando concluiu todas as aulas (e ganhou o certificado).' }
  },
  ['completed_lessons', 'total_lessons', 'percent', 'last_lesson_id', 'started_at', 'completed_at']
);

const certificateSchema: Schema = object(
  {
    code: { type: 'string', example: 'RZ-7K3Q-9FMA-2X' },
    track_id: id,
    track_title: title,
    worker_name: { type: 'string', example: 'Maria Trabalhadora' },
    workload_minutes: { type: 'integer', minimum: 0, example: 90 },
    completed_at: isoDate,
    // O exemplo é o resumo dos exemplos acima.
    data_hash: {
      type: 'string',
      pattern: '^[0-9a-f]{64}$',
      example: '77104f6c999f52615fae80e9dd85c149fd48f857266567a1370648c4b98aa291',
      description:
        'Resumo SHA-256 (hex) calculado na emissão: JSON de `[code, worker_name, track_title, workload_minutes, completed_at]`, ' +
        'sem espaços, em UTF-8. Qualquer mudança nesses dados muda o resumo. Vai impresso no certificado.'
    }
  },
  ['code', 'track_id', 'track_title', 'worker_name', 'workload_minutes', 'completed_at', 'data_hash'],
  'Certificado de conclusão emitido pela Ruraliza (dados do momento da emissão).'
);

const enrolledResponse: Properties = { message: { type: 'string', example: 'Lesson completed.' }, track: ref('EnrolledTrack') };

export const trackSchemas = {
  TrackStatus: { type: 'string', enum: Object.values(TRACK_STATUS), example: 'published' },
  TrackTutor: object({ id, name: { type: 'string', example: 'Tiago Tutor' } }, ['id', 'name']),
  Lesson: object(
    { id, title: { ...title, example: 'Quando colher' }, video_url: videoUrl, content, duration_minutes: minutes },
    ['id', 'title', 'video_url', 'content', 'duration_minutes']
  ),
  TrackModule: object({ id, title: { ...title, example: 'Preparação' }, lessons: { type: 'array', items: ref('Lesson') } }, ['id', 'title', 'lessons']),
  LessonOutline: object(
    { id, title: { ...title, example: 'Quando colher' }, duration_minutes: minutes, has_video: { type: 'boolean' } },
    ['id', 'title', 'duration_minutes', 'has_video']
  ),
  TrackModuleOutline: object(
    { id, title: { ...title, example: 'Preparação' }, lessons: { type: 'array', items: ref('LessonOutline') } },
    ['id', 'title', 'lessons']
  ),
  TrackProgress: progressSchema,
  WorkerTrackSummary: object(
    { ...summaryProps, progress: { ...progressSchema, nullable: true } },
    [...summaryRequired, 'progress'],
    'Trilha nas listas do trabalhador. `progress` é null para quem não começou.'
  ),
  TrackDetail: object(
    { ...summaryProps, progress: { ...progressSchema, nullable: true }, modules: { type: 'array', items: ref('TrackModuleOutline') } },
    [...summaryRequired, 'progress', 'modules']
  ),
  EnrolledTrack: object(enrolledProps, Object.keys(enrolledProps)),
  ManagedTrackSummary: object(managedSummaryProps, Object.keys(managedSummaryProps)),
  ManagedTrack: object(
    { ...managedSummaryProps, modules: { type: 'array', items: ref('TrackModule') }, created_by: id, insertion_date: isoDate },
    [...Object.keys(managedSummaryProps), 'modules', 'created_by', 'insertion_date']
  ),

  TrackInput: input(
    { title, description, categories, tutor_ids: { type: 'array', maxItems: LIMIT.tutors, items: id, description: 'Usuários de sistema com cargo tutor. Obrigatório (ao menos um) quando quem cria é administrador.' } },
    ['title', 'description', 'categories'],
    'Nasce em rascunho, sem conteúdo. O tutor que cria vira tutor da trilha; o administrador indica os tutores em `tutor_ids`.'
  ),
  TrackUpdate: input(
    {
      title,
      description,
      categories,
      tutor_ids: { type: 'array', minItems: 1, maxItems: LIMIT.tutors, items: id, description: 'Usuários de sistema com cargo tutor.' }
    },
    [],
    'Edição parcial. Outros campos são recusados (400).'
  ),
  TrackContentInput: input(
    {
      modules: {
        type: 'array',
        maxItems: LIMIT.modules,
        items: {
          type: 'object',
          required: ['title', 'lessons'],
          properties: {
            id: { ...id, description: 'Módulo existente. Sem id = módulo novo.' },
            title,
            lessons: {
              type: 'array',
              maxItems: LIMIT.lessonsPerModule,
              items: {
                type: 'object',
                required: ['title', 'duration_minutes'],
                properties: {
                  id: { ...id, description: 'Aula existente (pode vir de outro módulo). Sem id = aula nova.' },
                  title,
                  video_url: { ...videoUrl, description: 'Link do YouTube (watch, youtu.be, embed, shorts) ou do Vimeo.' },
                  content,
                  duration_minutes: minutes
                }
              }
            }
          }
        }
      }
    },
    ['modules'],
    'Substitui todos os módulos e aulas, na ordem enviada. Cada aula precisa de vídeo ou texto.'
  ),
  TrackStatusInput: input({ status: { type: 'string', enum: ['published', 'discontinued'] } }, ['status'], 'Não existe remoção nem volta para rascunho.'),
  EnrollInput: input({ worker_id: id }, ['worker_id'], 'O trabalhador que começa a trilha (precisa ser o dono do token).'),

  ManagedTrackResponse: object({ message: { type: 'string', example: 'Track updated successfully!' }, track: ref('ManagedTrack') }, ['message', 'track']),
  EnrolledTrackResponse: object(enrolledResponse, ['message', 'track']),
  LessonCompletionResponse: object(
    { ...enrolledResponse, issued_certificate: { ...certificateSchema, nullable: true } },
    ['message', 'track', 'issued_certificate'],
    '`issued_certificate` só vem preenchido quando esta conclusão fecha a trilha.'
  ),
  Certificate: certificateSchema
} satisfies Record<TrackSchemaName, Schema>;
