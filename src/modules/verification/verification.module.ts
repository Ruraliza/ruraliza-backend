import type { UserRole } from '#modules/accounts';
import type { AccessPolicies } from '#modules/auth';
import { GetVerificationDocumentUseCase } from './application/get-verification-document.usecase';
import { GetVerificationUseCase } from './application/get-verification.usecase';
import { ListVerificationsUseCase } from './application/list-verifications.usecase';
import { ReviewVerificationUseCase } from './application/review-verification.usecase';
import { SubmitVerificationUseCase } from './application/submit-verification.usecase';
import type { VerificationDeps } from './application/verification-deps';
import { type VerificationReader, createVerificationReader, removeVerificationOf } from './application/verification-reader';
import { createVerificationController } from './presentation/verification.controller';
import { type VerificationRoutes, verificationRoutes } from './presentation/verification.routes';

export type VerificationModuleDeps = VerificationDeps;

export interface VerificationUseCases {
  get: GetVerificationUseCase;
  submit: SubmitVerificationUseCase;
  list: ListVerificationsUseCase;
  document: GetVerificationDocumentUseCase;
  review: ReviewVerificationUseCase;
  // Quem tem o selo (ligado nas vagas e nas candidaturas pelo container).
  reader: VerificationReader;
  // Perfil removido: apaga o pedido e a foto.
  removeFor(role: UserRole, profileId: number): Promise<void>;
}

// Casos de uso da verificação de identidade (montados pelo container).
export function createVerificationUseCases(deps: VerificationModuleDeps): VerificationUseCases {
  return {
    get: new GetVerificationUseCase(deps),
    submit: new SubmitVerificationUseCase(deps),
    list: new ListVerificationsUseCase(deps),
    document: new GetVerificationDocumentUseCase(deps),
    review: new ReviewVerificationUseCase(deps),
    reader: createVerificationReader(deps),
    removeFor: (role, profileId) => removeVerificationOf(deps, role, profileId)
  };
}

// Rotas HTTP (o perfil em /api/farmers e /api/workers; a fila em /api/admin/verifications).
export function createVerificationRoutes(useCases: VerificationUseCases, access: AccessPolicies): VerificationRoutes {
  return verificationRoutes(createVerificationController(useCases), access);
}
