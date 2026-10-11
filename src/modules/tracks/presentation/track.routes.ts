import type { AccessPolicies } from '#modules/auth';
import { TAGS, operation, pathParam, queryParam } from '#shared/infra/docs/operations';
import { PUBLIC_ROUTE } from '#shared/infra/http/access';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { TrackController } from './track.controller';
import type { TrackSchemaName } from './track.schemas';

const trackId = pathParam('id', 'ID da trilha.');
const workerId = pathParam('id', 'ID do trabalhador.');
const workerTrackId = pathParam('trackId', 'ID da trilha.');
const lessonId = pathParam('lessonId', 'ID da aula.');
const viewer = queryParam('worker_id', 'O trabalhador que está vendo (traz o progresso dele).', { type: 'integer', minimum: 1 });
const trackOperation = operation<TrackSchemaName>;

const NOT_TUTOR = 'Você não é tutor desta trilha (403 do caso de uso).';

export interface TrackRoutes {
  // Em /api/admin: edição pelos tutores ('/tracks/tutors' antes de '/tracks/:id').
  manage: readonly RouteDef[];
  // Em /api/workers, antes de '/:id': lista, detalhe e matrícula.
  learning: readonly RouteDef[];
  // Em /api/workers: a trilha de quem está matriculado, as aulas concluídas e os certificados.
  progress: readonly RouteDef[];
  // Em /api/certificates: validação pública.
  certificates: readonly RouteDef[];
}

export function trackRoutes(tracks: TrackController, access: AccessPolicies): TrackRoutes {
  const tutor = access.system('tracks:manage');

  return {
    manage: [
      route('get', '/tracks', tracks.listManagedTracks, trackOperation({
        tag: TAGS.tracks,
        summary: 'Listar trilhas (tutor)',
        description: 'Todas as trilhas, em qualquer status, as editadas mais recentemente primeiro. `is_tutor` diz quais quem pediu pode editar.',
        success: { status: 200, description: 'Trilhas.', schema: { listOf: 'ManagedTrackSummary' } }
      }), tutor),

      route('get', '/tracks/tutors', tracks.listTrackTutors, trackOperation({
        tag: TAGS.tracks,
        summary: 'Tutores disponíveis',
        description: 'Usuários de sistema com cargo tutor, para escolher os tutores de uma trilha.',
        success: { status: 200, description: 'Tutores em ordem alfabética.', schema: { listOf: 'TrackTutor' } }
      }), tutor),

      route('post', '/tracks', tracks.createTrack, trackOperation({
        tag: TAGS.tracks,
        summary: 'Criar trilha',
        description: 'Nasce em `draft`, sem conteúdo, com quem criou como tutor.',
        body: 'TrackInput',
        success: { status: 201, description: 'Trilha criada.', schema: 'ManagedTrackResponse' },
        errors: { 400: 'Campo obrigatório faltando; nome ou descrição longos demais; categoria fora da lista.' }
      }), tutor),

      route('get', '/tracks/:id', tracks.getManagedTrack, trackOperation({
        tag: TAGS.tracks,
        summary: 'Detalhe da trilha (tutor)',
        params: [trackId],
        success: { status: 200, description: 'A trilha com todos os módulos e aulas.', schema: 'ManagedTrack' },
        errors: { 404: 'Trilha não encontrada.' }
      }), tutor),

      route('patch', '/tracks/:id', tracks.updateTrack, trackOperation({
        tag: TAGS.tracks,
        summary: 'Editar trilha',
        description: 'Nome, descrição, categorias e tutores. Só os tutores da trilha editam (e podem se retirar dela).',
        params: [trackId],
        body: 'TrackUpdate',
        success: { status: 200, description: 'Trilha atualizada.', schema: 'ManagedTrackResponse' },
        errors: {
          400: 'Campo não editável; valor vazio ou longo demais; categoria fora da lista; `tutor_ids` vazio ou com quem não é tutor.',
          403: NOT_TUTOR,
          404: 'Trilha não encontrada.'
        }
      }), tutor),

      route('put', '/tracks/:id/content', tracks.saveTrackContent, trackOperation({
        tag: TAGS.tracks,
        summary: 'Salvar módulos e aulas',
        description:
          'Substitui todo o conteúdo, na ordem enviada. Itens com `id` mantêm o id (o progresso dos alunos continua valendo); ' +
          'itens sem `id` são novos. Ids nunca são reaproveitados.',
        params: [trackId],
        body: 'TrackContentInput',
        success: { status: 200, description: 'Conteúdo salvo.', schema: 'ManagedTrackResponse' },
        errors: {
          400: 'Título vazio; duração fora de 1 a 600 minutos; aula sem vídeo nem texto; vídeo que não é do YouTube/Vimeo; limites excedidos; id que não existe na trilha ou repetido.',
          403: NOT_TUTOR,
          404: 'Trilha não encontrada.',
          409: 'Trilha já publicada ficaria sem aulas ou com módulo vazio.'
        }
      }), tutor),

      route('patch', '/tracks/:id/status', tracks.changeTrackStatus, trackOperation({
        tag: TAGS.tracks,
        summary: 'Publicar, descontinuar ou reativar',
        description:
          '`draft → published → discontinued → published`. Não há remoção nem volta para rascunho. Descontinuada some da lista ' +
          'dos trabalhadores e não aceita alunos novos, mas quem já começou continua até o certificado.',
        params: [trackId],
        body: 'TrackStatusInput',
        success: { status: 200, description: 'Status atualizado.', schema: 'ManagedTrackResponse' },
        errors: {
          400: '`status` diferente de published e discontinued.',
          403: NOT_TUTOR,
          404: 'Trilha não encontrada.',
          409: 'Transição não permitida; publicar sem aulas ou com módulo vazio.'
        }
      }), tutor)
    ],

    learning: [
      route('get', '/tracks', tracks.listTracks, trackOperation({
        tag: TAGS.learning,
        summary: 'Trilhas disponíveis',
        description:
          'Trilhas publicadas e, com `worker_id`, também as descontinuadas em que ele já está matriculado (com o progresso). ' +
          'Em andamento primeiro, depois as mais recentes.',
        params: [
          queryParam('q', 'Busca no nome, na descrição e nas categorias (sem acento, todas as palavras).', { type: 'string', maxLength: 100 }),
          queryParam('category', 'Uma das categorias de GET /api/categories.', { type: 'string' }),
          viewer
        ],
        success: { status: 200, description: 'Trilhas.', schema: { listOf: 'WorkerTrackSummary' } },
        errors: { 400: 'Busca longa demais; `worker_id` inválido.' }
      }), access.worker()),

      route('get', '/tracks/:id', tracks.getTrackDetail, trackOperation({
        tag: TAGS.learning,
        summary: 'Detalhe da trilha (antes de começar)',
        description: 'Descrição, tutores, carga horária e o sumário de módulos e aulas, sem o conteúdo.',
        params: [trackId, viewer],
        success: { status: 200, description: 'A trilha.', schema: 'TrackDetail' },
        errors: { 400: '`worker_id` inválido.', 404: 'Trilha não encontrada, em rascunho, ou descontinuada para quem não começou.' }
      }), access.worker()),

      route('post', '/tracks/:id/enroll', tracks.enrollInTrack, trackOperation({
        tag: TAGS.learning,
        summary: 'Começar a trilha',
        description: 'Repetir é seguro: quem já começou recebe a matrícula que tem.',
        params: [trackId],
        body: 'EnrollInput',
        success: { status: 200, description: 'Matrícula (nova ou a existente), com a trilha completa.', schema: 'EnrolledTrackResponse' },
        errors: {
          400: '`worker_id` faltando ou inválido.',
          404: 'Trabalhador não encontrado; trilha não encontrada ou em rascunho.',
          409: 'Trilha descontinuada (não aceita alunos novos).'
        }
      }), access.workerInBody())
    ],

    progress: [
      route('get', '/:id/tracks/:trackId', tracks.getEnrolledTrack, trackOperation({
        tag: TAGS.learning,
        summary: 'Estudar a trilha',
        description: 'A trilha completa, com o conteúdo das aulas e o progresso. Vale também para trilha descontinuada.',
        params: [workerId, workerTrackId],
        success: { status: 200, description: 'A trilha do aluno.', schema: 'EnrolledTrack' },
        errors: { 403: 'O trabalhador não está matriculado.', 404: 'Trilha não encontrada.' }
      }), access.ownWorker()),

      route('put', '/:id/tracks/:trackId/lessons/:lessonId/completion', tracks.completeLesson, trackOperation({
        tag: TAGS.learning,
        summary: 'Concluir aula',
        description: 'Repetir não muda nada. A última aula que faltava conclui a trilha e emite o certificado (`issued_certificate`).',
        params: [workerId, workerTrackId, lessonId],
        success: { status: 200, description: 'Aula concluída.', schema: 'LessonCompletionResponse' },
        errors: { 403: 'O trabalhador não está matriculado.', 404: 'Trilha ou aula não encontrada.' }
      }), access.ownWorker()),

      route('delete', '/:id/tracks/:trackId/lessons/:lessonId/completion', tracks.uncompleteLesson, trackOperation({
        tag: TAGS.learning,
        summary: 'Desmarcar aula',
        description: 'Trilha já concluída continua concluída, e o certificado continua válido.',
        params: [workerId, workerTrackId, lessonId],
        success: { status: 200, description: 'Aula desmarcada.', schema: 'EnrolledTrackResponse' },
        errors: { 403: 'O trabalhador não está matriculado.', 404: 'Trilha ou aula não encontrada.' }
      }), access.ownWorker()),

      route('get', '/:id/certificates', tracks.listWorkerCertificates, trackOperation({
        tag: TAGS.learning,
        summary: 'Certificados do trabalhador',
        params: [workerId],
        success: { status: 200, description: 'Os mais recentes primeiro.', schema: { listOf: 'Certificate' } }
      }), access.ownWorker())
    ],

    certificates: [
      route('get', '/:code', tracks.getCertificate, trackOperation({
        tag: TAGS.certificates,
        summary: 'Validar certificado',
        description: 'Confere um certificado pelo código impresso nele (sem diferenciar maiúsculas).',
        params: [{ name: 'code', in: 'path', required: true, description: 'Código do certificado.', schema: { type: 'string' }, example: 'RZ-7K3Q-9FMA-2X' }],
        success: { status: 200, description: 'Certificado válido.', schema: 'Certificate' },
        errors: { 404: 'Nenhum certificado com este código.' }
      }), PUBLIC_ROUTE)
    ]
  };
}
