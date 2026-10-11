import { canDo, systemActor } from '#modules/system-users';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams, Principal } from '#shared/infra/http/types';
import type {
  Certificate,
  EnrolledTrack,
  EnrolledTrackResponse,
  LessonCompletionResponse,
  ManagedTrack,
  ManagedTrackResponse,
  ManagedTrackSummary,
  TrackDetail,
  TrackTutor,
  WorkerTrackSummary
} from '../track.contract';
import type { TrackActor } from '../domain/track';
import type { TrackUseCases } from '../tracks.module';
import {
  parseEnrollInput,
  parseTrackContent,
  parseTrackFilters,
  parseTrackInput,
  parseTrackStatus,
  parseTrackUpdate,
  parseWorkerIdQuery
} from './track.parsers';

export interface WorkerTrackParams {
  id: string; // trabalhador
  trackId: string;
}
export interface LessonParams extends WorkerTrackParams {
  lessonId: string;
}
export interface CertificateParams {
  code: string;
}

// HTTP das trilhas: edição pelos tutores (/api/admin/tracks), estudo pelos trabalhadores
// (/api/workers) e a validação pública dos certificados (/api/certificates).
export interface TrackController {
  listManagedTracks: Handler<ManagedTrackSummary[]>;
  listTrackTutors: Handler<TrackTutor[]>;
  createTrack: Handler<ManagedTrackResponse>;
  getManagedTrack: Handler<ManagedTrack, IdParams>;
  updateTrack: Handler<ManagedTrackResponse, IdParams>;
  saveTrackContent: Handler<ManagedTrackResponse, IdParams>;
  changeTrackStatus: Handler<ManagedTrackResponse, IdParams>;
  listTracks: Handler<WorkerTrackSummary[]>;
  getTrackDetail: Handler<TrackDetail, IdParams>;
  enrollInTrack: Handler<EnrolledTrackResponse, IdParams>;
  getEnrolledTrack: Handler<EnrolledTrack, WorkerTrackParams>;
  completeLesson: Handler<LessonCompletionResponse, LessonParams>;
  uncompleteLesson: Handler<EnrolledTrackResponse, LessonParams>;
  listWorkerCertificates: Handler<Certificate[], IdParams>;
  getCertificate: Handler<Certificate, CertificateParams>;
}

// Quem age nas rotas dos tutores: o administrador (`tracks:oversee`) edita qualquer trilha.
function actorOf(principal: Principal | undefined): TrackActor {
  const { id, role } = systemActor(principal);
  return { id, oversees: canDo(role, 'tracks:oversee') };
}

export function createTrackController(tracks: TrackUseCases): TrackController {
  // GET /api/admin/tracks - Todas as trilhas (qualquer status)
  const listManagedTracks: Handler<ManagedTrackSummary[]> = async (_req, res) => {
    res.status(200).json(await tracks.listManagedTracks.execute({ actor: actorOf(res.locals.principal) }));
  };

  // GET /api/admin/tracks/tutors - Quem pode ser tutor
  const listTrackTutors: Handler<TrackTutor[]> = async (_req, res) => {
    res.status(200).json(await tracks.listTutors.execute());
  };

  // POST /api/admin/tracks - Cria uma trilha em rascunho
  const createTrack: Handler<ManagedTrackResponse> = async (req, res) => {
    const input = parseTrackInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await tracks.createTrack.execute({ actor: actorOf(res.locals.principal), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Track created successfully!', track: result.value });
  };

  // GET /api/admin/tracks/:id - A trilha completa
  const getManagedTrack: Handler<ManagedTrack, IdParams> = async (req, res) => {
    const result = await tracks.getManagedTrack.execute({ actor: actorOf(res.locals.principal), trackId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // PATCH /api/admin/tracks/:id - Nome, descrição, categorias e tutores
  const updateTrack: Handler<ManagedTrackResponse, IdParams> = async (req, res) => {
    const changes = parseTrackUpdate(toBody(req.body));
    if (!changes.ok) { sendFailure(res, changes); return; }
    const result = await tracks.updateTrack.execute({ actor: actorOf(res.locals.principal), trackId: toId(req.params.id), changes: changes.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Track updated successfully!', track: result.value });
  };

  // PUT /api/admin/tracks/:id/content - Módulos e aulas
  const saveTrackContent: Handler<ManagedTrackResponse, IdParams> = async (req, res) => {
    const content = parseTrackContent(toBody(req.body));
    if (!content.ok) { sendFailure(res, content); return; }
    const result = await tracks.saveTrackContent.execute({ actor: actorOf(res.locals.principal), trackId: toId(req.params.id), content: content.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Track content saved successfully!', track: result.value });
  };

  // PATCH /api/admin/tracks/:id/status - Publicar, descontinuar ou reativar
  const changeTrackStatus: Handler<ManagedTrackResponse, IdParams> = async (req, res) => {
    const status = parseTrackStatus(toBody(req.body));
    if (!status.ok) { sendFailure(res, status); return; }
    const result = await tracks.changeTrackStatus.execute({ actor: actorOf(res.locals.principal), trackId: toId(req.params.id), status: status.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Track status updated successfully!', track: result.value });
  };

  // GET /api/workers/tracks?q=&category=&worker_id= - Trilhas disponíveis
  const listTracks: Handler<WorkerTrackSummary[]> = async (req, res) => {
    const filters = parseTrackFilters(req.query);
    if (!filters.ok) { sendFailure(res, filters); return; }
    res.status(200).json(await tracks.listTracks.execute(filters.value));
  };

  // GET /api/workers/tracks/:id?worker_id= - A trilha antes de começar
  const getTrackDetail: Handler<TrackDetail, IdParams> = async (req, res) => {
    const viewer = parseWorkerIdQuery(req.query);
    if (!viewer.ok) { sendFailure(res, viewer); return; }
    const result = await tracks.getTrackDetail.execute({ trackId: toId(req.params.id), workerId: viewer.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  // POST /api/workers/tracks/:id/enroll - Começar a trilha (repetir devolve a matrícula que já existe)
  const enrollInTrack: Handler<EnrolledTrackResponse, IdParams> = async (req, res) => {
    const input = parseEnrollInput(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }
    const result = await tracks.enroll.execute({ trackId: toId(req.params.id), workerId: input.value.worker_id });
    if (!result.ok) { sendFailure(res, result); return; }
    const { track, created } = result.value;
    res.status(200).json({ message: created ? 'Enrolled successfully!' : 'Already enrolled.', track });
  };

  // GET /api/workers/:id/tracks/:trackId - A trilha completa, para quem está matriculado
  const getEnrolledTrack: Handler<EnrolledTrack, WorkerTrackParams> = async (req, res) => {
    const result = await tracks.getEnrolledTrack.execute({ trackId: toId(req.params.trackId), workerId: toId(req.params.id) });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  const lessonOf = (params: LessonParams): { trackId: number; workerId: number; lessonId: number } => ({
    trackId: toId(params.trackId), workerId: toId(params.id), lessonId: toId(params.lessonId)
  });

  // PUT /api/workers/:id/tracks/:trackId/lessons/:lessonId/completion - Concluir a aula
  const completeLesson: Handler<LessonCompletionResponse, LessonParams> = async (req, res) => {
    const result = await tracks.completeLesson.execute(lessonOf(req.params));
    if (!result.ok) { sendFailure(res, result); return; }
    const { track, issued_certificate } = result.value;
    res.status(200).json({ message: issued_certificate ? 'Track completed!' : 'Lesson completed.', track, issued_certificate });
  };

  // DELETE /api/workers/:id/tracks/:trackId/lessons/:lessonId/completion - Desmarcar a aula
  const uncompleteLesson: Handler<EnrolledTrackResponse, LessonParams> = async (req, res) => {
    const result = await tracks.uncompleteLesson.execute(lessonOf(req.params));
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Lesson marked as not completed.', track: result.value });
  };

  // GET /api/workers/:id/certificates - Certificados do trabalhador
  const listWorkerCertificates: Handler<Certificate[], IdParams> = async (req, res) => {
    res.status(200).json(await tracks.listCertificates.execute({ workerId: toId(req.params.id) }));
  };

  // GET /api/certificates/:code - Validação pública
  const getCertificate: Handler<Certificate, CertificateParams> = async (req, res) => {
    const result = await tracks.getCertificate.execute({ code: req.params.code });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json(result.value);
  };

  return {
    listManagedTracks, listTrackTutors, createTrack, getManagedTrack, updateTrack, saveTrackContent, changeTrackStatus,
    listTracks, getTrackDetail, enrollInTrack, getEnrolledTrack, completeLesson, uncompleteLesson, listWorkerCertificates, getCertificate
  };
}
