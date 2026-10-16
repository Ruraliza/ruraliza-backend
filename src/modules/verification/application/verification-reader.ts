import type { UserRole } from '#modules/accounts';
import { isVerified } from '../domain/verification';
import { type VerificationDeps, dropDocument, findVerification, identityOf } from './verification-deps';

// Quem tem o selo, para as vagas (produtores) e as candidaturas (trabalhadores). O container liga
// nos módulos de serviços e de contratação. TODO(db): uma consulta só, com IN e JOIN no perfil.
export interface VerificationReader {
  verifiedFarmers(farmerIds: readonly number[]): Promise<ReadonlySet<number>>;
  verifiedWorkers(workerIds: readonly number[]): Promise<ReadonlySet<number>>;
}

export function createVerificationReader(deps: VerificationDeps): VerificationReader {
  async function verified(role: UserRole, ids: readonly number[]): Promise<ReadonlySet<number>> {
    const result = new Set<number>();
    for (const id of new Set(ids)) {
      const record = await findVerification(deps, role, id);
      if (record?.status !== 'approved') continue;
      const identity = await identityOf(deps, role, id);
      if (identity && isVerified(record, identity.name)) result.add(id);
    }
    return result;
  }
  return {
    verifiedFarmers: (ids) => verified('farmer', ids),
    verifiedWorkers: (ids) => verified('worker', ids)
  };
}

// Perfil removido: o pedido e a foto do documento saem junto.
export async function removeVerificationOf(deps: VerificationDeps, role: UserRole, profileId: number): Promise<void> {
  const record = await findVerification(deps, role, profileId);
  if (!record) return;
  await dropDocument(deps, record);
  await deps.verifications.delete(record.id);
}
