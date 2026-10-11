import type { SystemUserRepository } from '#modules/system-users';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { CertificateRepository } from '../domain/certificate';
import { type EnrollmentRepository, findEnrollment } from '../domain/enrollment';
import { TRACK_NOT_FOUND, TRACK_STATUS, type TrackRepository } from '../domain/track';
import type { EnrolledTrack } from '../track.contract';
import { toEnrolledTrack } from './track-views';

export interface EnrollDeps {
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  certificates: CertificateRepository;
  workers: WorkerRepository;
  systemUsers: SystemUserRepository;
  clock: Clock;
}

// Começa a trilha. Repetir é seguro: quem já começou recebe a matrícula que tem.
// Trilha descontinuada não aceita aluno novo.
export class EnrollUseCase {
  constructor(private readonly deps: EnrollDeps) {}

  async execute({ trackId, workerId }: { trackId: number; workerId: number }): Promise<Result<{ track: EnrolledTrack; created: boolean }>> {
    const worker = await this.deps.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const track = await this.deps.tracks.findById(trackId);
    if (!track || track.status === TRACK_STATUS.DRAFT) return notFound(TRACK_NOT_FOUND);

    const existing = await findEnrollment(this.deps.enrollments, track.id, worker.id);
    if (existing) return ok({ track: await toEnrolledTrack(this.deps, track, existing), created: false });
    if (track.status === TRACK_STATUS.DISCONTINUED) return conflict('Esta trilha foi descontinuada e não aceita novos alunos.');

    const enrollment = await this.deps.enrollments.create({
      track_id: track.id,
      worker_id: worker.id,
      completed_lesson_ids: [],
      last_lesson_id: null,
      started_at: this.deps.clock.now(),
      completed_at: null
    });
    return ok({ track: await toEnrolledTrack(this.deps, track, enrollment), created: true });
  }
}
