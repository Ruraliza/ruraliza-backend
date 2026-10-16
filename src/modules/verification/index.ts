// API pública do módulo de verificação de identidade: o único arquivo que outros módulos enxergam (#modules/verification).
export type * from './verification.contract';
export type { VerificationRecord, VerificationRepository } from './domain/verification';
export type { VerificationReader } from './application/verification-reader';
export { createInMemoryVerificationRepository } from './infra/in-memory-verification.repository';
export type { VerificationRoutes } from './presentation/verification.routes';
export { type VerificationSchemaName, verificationSchemas } from './presentation/verification.schemas';
export {
  type VerificationModuleDeps,
  type VerificationUseCases,
  createVerificationRoutes,
  createVerificationUseCases
} from './verification.module';
