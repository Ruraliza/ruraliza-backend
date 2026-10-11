import type { SystemUserRepository } from '#modules/system-users';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { type Result, ok, requireFound } from '#shared/domain/result';
import { type CertificateCodes, type CertificateRecord, type CertificateRepository, toCertificate } from '../domain/certificate';
import { type EnrollmentRepository, currentCompleted } from '../domain/enrollment';
import { type TrackRecord, type TrackRepository, allLessons, workloadMinutes } from '../domain/track';
import type { Certificate, EnrolledTrack } from '../track.contract';
import { findLessonOfEnrollment } from './find-enrollment';
import { toEnrolledTrack } from './track-views';

export interface CompleteLessonDeps {
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  certificates: CertificateRepository;
  workers: WorkerRepository;
  systemUsers: SystemUserRepository;
  clock: Clock;
  codes: CertificateCodes;
}

export interface LessonCompletion {
  track: EnrolledTrack;
  issued_certificate: Certificate | null;
}

// Marca a aula como concluída (repetir não muda nada). Ao concluir a última aula que faltava,
// a trilha fica concluída e o certificado é emitido, uma vez só, com o nome atual do trabalhador.
export class CompleteLessonUseCase {
  constructor(private readonly deps: CompleteLessonDeps) {}

  async execute(input: { trackId: number; workerId: number; lessonId: number }): Promise<Result<LessonCompletion>> {
    const found = await findLessonOfEnrollment(this.deps, input);
    if (!found.ok) return found;
    const { track, enrollment } = found.value;
    const now = this.deps.clock.now();

    if (!enrollment.completed_lesson_ids.includes(input.lessonId)) enrollment.completed_lesson_ids.push(input.lessonId);
    enrollment.last_lesson_id = input.lessonId;

    let issued: Certificate | null = null;
    if (enrollment.completed_at === null && currentCompleted(track, enrollment).length === allLessons(track).length) {
      enrollment.completed_at = now;
      issued = toCertificate(await this.issue(track, enrollment.worker_id, now));
    }
    await this.deps.enrollments.update(enrollment);
    return ok({ track: await toEnrolledTrack(this.deps, track, enrollment), issued_certificate: issued });
  }

  private async issue(track: TrackRecord, workerId: number, now: string): Promise<CertificateRecord> {
    const [existing] = await this.deps.certificates.find({ track_id: track.id, worker_id: workerId });
    if (existing) return existing;

    const worker = requireFound(await this.deps.workers.findById(workerId), `trabalhador ${workerId} da matrícula`);
    let code = this.deps.codes.create();
    // Colisão é improvável (~49 bits), mas o código precisa ser único.
    while ((await this.deps.certificates.find({ code })).length > 0) code = this.deps.codes.create();

    return this.deps.certificates.create({
      code,
      track_id: track.id,
      worker_id: workerId,
      track_title: track.title,
      worker_name: worker.name,
      workload_minutes: workloadMinutes(track),
      completed_at: now,
      issued_at: now
    });
  }
}
