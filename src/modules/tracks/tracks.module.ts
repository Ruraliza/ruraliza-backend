import type { AccessPolicies } from '#modules/auth';
import type { SystemUserRepository } from '#modules/system-users';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { ChangeTrackStatusUseCase } from './application/change-track-status.usecase';
import { CompleteLessonUseCase } from './application/complete-lesson.usecase';
import { CreateTrackUseCase } from './application/create-track.usecase';
import { EnrollUseCase } from './application/enroll.usecase';
import { GetCertificateUseCase } from './application/get-certificate.usecase';
import { GetEnrolledTrackUseCase } from './application/get-enrolled-track.usecase';
import { GetManagedTrackUseCase } from './application/get-managed-track.usecase';
import { GetTrackDetailUseCase } from './application/get-track-detail.usecase';
import { ListCertificatesUseCase } from './application/list-certificates.usecase';
import { ListManagedTracksUseCase } from './application/list-managed-tracks.usecase';
import { ListTracksUseCase } from './application/list-tracks.usecase';
import { ListTutorsUseCase } from './application/list-tutors.usecase';
import { SaveTrackContentUseCase } from './application/save-track-content.usecase';
import { UncompleteLessonUseCase } from './application/uncomplete-lesson.usecase';
import { UpdateTrackUseCase } from './application/update-track.usecase';
import type { CertificateCodes, CertificateRepository } from './domain/certificate';
import type { EnrollmentRepository } from './domain/enrollment';
import type { TrackRepository } from './domain/track';
import { createTrackController } from './presentation/track.controller';
import { type TrackRoutes, trackRoutes } from './presentation/track.routes';

export interface TracksModuleDeps {
  tracks: TrackRepository;
  enrollments: EnrollmentRepository;
  certificates: CertificateRepository;
  workers: WorkerRepository;
  systemUsers: SystemUserRepository;
  clock: Clock;
  codes: CertificateCodes;
}

export interface TrackUseCases {
  createTrack: CreateTrackUseCase;
  updateTrack: UpdateTrackUseCase;
  saveTrackContent: SaveTrackContentUseCase;
  changeTrackStatus: ChangeTrackStatusUseCase;
  listManagedTracks: ListManagedTracksUseCase;
  getManagedTrack: GetManagedTrackUseCase;
  listTutors: ListTutorsUseCase;
  listTracks: ListTracksUseCase;
  getTrackDetail: GetTrackDetailUseCase;
  enroll: EnrollUseCase;
  getEnrolledTrack: GetEnrolledTrackUseCase;
  completeLesson: CompleteLessonUseCase;
  uncompleteLesson: UncompleteLessonUseCase;
  listCertificates: ListCertificatesUseCase;
  getCertificate: GetCertificateUseCase;
}

// Casos de uso das trilhas de estudo e dos certificados (montados pelo container).
export function createTrackUseCases(deps: TracksModuleDeps): TrackUseCases {
  return {
    createTrack: new CreateTrackUseCase(deps),
    updateTrack: new UpdateTrackUseCase(deps),
    saveTrackContent: new SaveTrackContentUseCase(deps),
    changeTrackStatus: new ChangeTrackStatusUseCase(deps),
    listManagedTracks: new ListManagedTracksUseCase(deps),
    getManagedTrack: new GetManagedTrackUseCase(deps),
    listTutors: new ListTutorsUseCase(deps),
    listTracks: new ListTracksUseCase(deps),
    getTrackDetail: new GetTrackDetailUseCase(deps),
    enroll: new EnrollUseCase(deps),
    getEnrolledTrack: new GetEnrolledTrackUseCase(deps),
    completeLesson: new CompleteLessonUseCase(deps),
    uncompleteLesson: new UncompleteLessonUseCase(deps),
    listCertificates: new ListCertificatesUseCase(deps),
    getCertificate: new GetCertificateUseCase(deps)
  };
}

// Rotas HTTP das trilhas (tutores em /api/admin, trabalhadores em /api/workers, validação em /api/certificates).
export function createTrackRoutes(useCases: TrackUseCases, access: AccessPolicies): TrackRoutes {
  return trackRoutes(createTrackController(useCases), access);
}
