import { type AccountRepository, type UserRole, findAccountOf } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { PushNotifier } from '#modules/notifications';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import type { ImageProcessor, ImageStore } from '#shared/domain/images';
import type { VerificationRecord, VerificationRepository } from '../domain/verification';
import type { AdminVerification } from '../verification.contract';

export interface VerificationDeps {
  verifications: VerificationRepository;
  farmers: FarmerRepository;
  workers: WorkerRepository;
  accounts: AccountRepository;
  // Fotos dos documentos: armazenamento PRIVADO, separado do de /api/images (só a equipe vê, pela administração).
  idDocuments: { processor: ImageProcessor; store: ImageStore };
  clock: Clock;
  push: PushNotifier;
}

export const REMOVED_PROFILE = '(perfil removido)';

export interface ProfileIdentity {
  name: string;
  cpf: string;
}

export async function identityOf({ farmers, workers }: VerificationDeps, role: UserRole, id: number): Promise<ProfileIdentity | undefined> {
  const profile = await (role === 'farmer' ? farmers.findById(id) : workers.findById(id));
  return profile ? { name: profile.name, cpf: profile.cpf } : undefined;
}

export async function findVerification(deps: VerificationDeps, role: UserRole, profileId: number): Promise<VerificationRecord | undefined> {
  const [record] = await deps.verifications.find({ role, profile_id: profileId });
  return record;
}

// O pedido como a equipe vê, com o nome e o CPF completos do perfil para conferir com o documento.
export async function toAdminVerification(deps: VerificationDeps, record: VerificationRecord): Promise<AdminVerification> {
  const identity = await identityOf(deps, record.role, record.profile_id);
  const account = identity ? await findAccountOf(deps.accounts, record.role, record.profile_id) : undefined;
  const { id, role, profile_id, document_type, status, submitted_at, reviewed_at, rejection_reason, document_id } = record;
  return {
    id, role, profile_id, account_id: account?.id ?? null,
    name: identity?.name ?? REMOVED_PROFILE, cpf: identity?.cpf ?? '',
    document_type, status, submitted_at, reviewed_at, rejection_reason, has_document: document_id !== null
  };
}

// Apaga a foto do documento (sem erro se já não existir).
export async function dropDocument(deps: VerificationDeps, record: VerificationRecord): Promise<void> {
  if (record.document_id !== null) await deps.idDocuments.store.delete(record.document_id);
}
