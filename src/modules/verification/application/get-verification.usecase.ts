import type { UserRole } from '#modules/accounts';
import { type Result, notFound, ok } from '#shared/domain/result';
import { toVerification } from '../domain/verification';
import type { Verification } from '../verification.contract';
import { type VerificationDeps, findVerification, identityOf } from './verification-deps';

// Situação da verificação do próprio perfil (para o cartão do perfil).
export class GetVerificationUseCase {
  constructor(private readonly deps: VerificationDeps) {}

  async execute({ role, profileId }: { role: UserRole; profileId: number }): Promise<Result<Verification>> {
    const identity = await identityOf(this.deps, role, profileId);
    if (!identity) return notFound('Perfil não encontrado.');
    return ok(toVerification(await findVerification(this.deps, role, profileId), identity.name));
  }
}
