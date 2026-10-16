import type { UserRole } from '#modules/accounts';
import type { Repository } from '#shared/domain/repository';
import { searchable } from '#shared/utils/search';
import type { Verification, VerificationDocumentType } from '../verification.contract';

// Pedido de verificação como fica guardado: um por perfil (o reenvio substitui o anterior).
// TODO(db): tabela `verifications (id, role, profile_id UNIQUE junto com role, document_type, document_id,
// status, submitted_at, reviewed_at, rejection_reason, verified_name)`. A foto não vai para o banco.
export interface VerificationRecord {
  id: number;
  role: UserRole;
  profile_id: number;
  document_type: VerificationDocumentType;
  document_id: string | null; // foto no armazenamento privado; null depois da decisão
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  verified_name: string | null; // nome do perfil quando foi aprovada
}

export type VerificationRepository = Repository<VerificationRecord, 'role' | 'profile_id' | 'status'>;

export const DOCUMENT_TYPES: readonly VerificationDocumentType[] = ['rg', 'cnh'];
export const DOCUMENT_LABEL: Readonly<Record<VerificationDocumentType, string>> = { rg: 'RG', cnh: 'CNH' };
// Maior que as fotos do app (1000px): o nome e o CPF do documento precisam ficar legíveis.
export const DOCUMENT_MAX_SIDE = 1600;
export const REJECTION_REASON_MAX_LENGTH = 300;

// Mesmo nome, sem diferenciar acento, maiúscula e espaços repetidos.
export function sameName(a: string, b: string): boolean {
  const normalize = (name: string): string => searchable(name).replace(/\s+/g, ' ').trim();
  return normalize(a) === normalize(b);
}

// O selo vale enquanto o perfil tiver o nome que a equipe conferiu no documento.
export function isVerified(record: VerificationRecord | undefined, currentName: string): boolean {
  return record?.status === 'approved' && record.verified_name !== null && sameName(record.verified_name, currentName);
}

export const NO_VERIFICATION: Verification = {
  status: 'none', document_type: null, submitted_at: null, reviewed_at: null, rejection_reason: null, verified: false
};

export function toVerification(record: VerificationRecord | undefined, currentName: string): Verification {
  if (!record) return NO_VERIFICATION;
  const { status, document_type, submitted_at, reviewed_at, rejection_reason } = record;
  return { status, document_type, submitted_at, reviewed_at, rejection_reason, verified: isVerified(record, currentName) };
}
