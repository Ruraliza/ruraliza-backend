// API pública do módulo de trilhas de estudo: o único arquivo que outros módulos enxergam (#modules/tracks).
export type * from './track.contract';
export type { CertificateCodes, CertificateHasher, CertificateRepository } from './domain/certificate';
export type { EnrollmentRepository } from './domain/enrollment';
export { TRACK_STATUS, type TrackActor, type TrackRecord, type TrackRepository } from './domain/track';
export { createInMemoryCertificateRepository, createInMemoryEnrollmentRepository, createInMemoryTrackRepository } from './infra/in-memory-track.repositories';
export { randomCertificateCodes } from './infra/random-certificate-codes';
export { sha256CertificateHasher } from './infra/sha256-certificate-hasher';
export type { TrackRoutes } from './presentation/track.routes';
export { type TrackSchemaName, trackSchemas } from './presentation/track.schemas';
export { type TrackUseCases, type TracksModuleDeps, createTrackRoutes, createTrackUseCases } from './tracks.module';
