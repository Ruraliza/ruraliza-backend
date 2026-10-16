// Verificação de identidade (issue #20): a pessoa envia a foto de um documento (RG ou CNH); a equipe
// confere o nome e o CPF com o perfil e decide. Aprovada, o perfil ganha o selo de verificado.
// A foto do documento é apagada logo depois da decisão (LGPD: só o necessário, pelo tempo necessário).

export type VerificationDocumentType = 'rg' | 'cnh';
export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

// GET e POST /farmers/:id/verification e /workers/:id/verification (POST: a foto no corpo, ?document_type=)
export interface Verification {
  status: VerificationStatus; // 'none': nunca enviou
  document_type: VerificationDocumentType | null;
  submitted_at: string | null; // ISO 8601
  reviewed_at: string | null;
  rejection_reason: string | null; // recusada: o que corrigir antes de enviar de novo
  verified: boolean; // o selo aparece: aprovada e com o mesmo nome do perfil de quando foi conferida
}

export interface VerificationResponse {
  message: string;
  verification: Verification;
}

// GET /admin/verifications: o pedido como a equipe vê, para conferir com o documento.
export interface AdminVerification {
  id: number;
  role: 'farmer' | 'worker';
  profile_id: number;
  account_id: number | null;
  name: string; // nome no perfil ('(perfil removido)' se não existe mais)
  cpf: string; // completo, para conferir com o documento
  document_type: VerificationDocumentType;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  has_document: boolean; // a foto ainda existe (só enquanto está em análise): GET /admin/verifications/:id/document
}

// PATCH /admin/verifications/:id
export interface VerificationReviewInput {
  status: 'approved' | 'rejected';
  reason?: string | null; // obrigatório ao recusar: a pessoa vê, para corrigir
}

export interface AdminVerificationResponse {
  message: string;
  verification: AdminVerification;
}
