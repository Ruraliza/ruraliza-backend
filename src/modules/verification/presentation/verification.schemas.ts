import { type RefTo, type Schema, id, input, isoDate, nullableId, object, refTo } from '#shared/infra/docs/schema-kit';
import { DOCUMENT_TYPES, REJECTION_REASON_MAX_LENGTH } from '../domain/verification';

// Schemas OpenAPI da verificação de identidade (contrato em ../verification.contract.ts). Registrados em src/docs/schemas.ts.
export type VerificationSchemaName =
  | 'VerificationDocumentType'
  | 'Verification'
  | 'VerificationResponse'
  | 'AdminVerification'
  | 'VerificationReviewInput'
  | 'AdminVerificationResponse';

const ref: RefTo<VerificationSchemaName> = refTo;

const nullableDate: Schema = { ...isoDate, nullable: true, example: null };
const reason: Schema = {
  type: 'string', maxLength: REJECTION_REASON_MAX_LENGTH, nullable: true, example: 'A foto ficou tremida e o CPF não dá para ler.',
  description: 'Motivo da recusa, que a pessoa vê para corrigir. Obrigatório ao recusar.'
};

export const verificationSchemas = {
  VerificationDocumentType: { type: 'string', enum: [...DOCUMENT_TYPES], example: 'cnh', description: '`rg` ou `cnh`, a frente, onde aparecem o nome e o CPF.' },
  Verification: object(
    {
      status: {
        type: 'string', enum: ['none', 'pending', 'approved', 'rejected'], example: 'pending',
        description: '`none` (nunca enviou), `pending` (em análise), `approved` ou `rejected` (veja `rejection_reason`).'
      },
      document_type: { type: 'string', enum: [...DOCUMENT_TYPES, null], nullable: true, example: 'cnh', description: 'Documento enviado (null se nunca enviou).' },
      submitted_at: nullableDate,
      reviewed_at: nullableDate,
      rejection_reason: reason,
      verified: {
        type: 'boolean', example: false,
        description: 'O selo aparece: aprovada e com o mesmo nome do perfil de quando foi conferida (mudou o nome, verifique de novo).'
      }
    },
    ['status', 'document_type', 'submitted_at', 'reviewed_at', 'rejection_reason', 'verified'],
    'Situação da verificação de identidade do perfil.'
  ),
  VerificationResponse: object({ message: { type: 'string', example: 'Verification requested.' }, verification: ref('Verification') }, ['message', 'verification']),
  AdminVerification: object(
    {
      id,
      role: { type: 'string', enum: ['farmer', 'worker'], example: 'worker' },
      profile_id: id,
      account_id: { ...nullableId, description: 'Conta, para abrir em GET /api/admin/users/{id}.' },
      name: { type: 'string', example: 'Maria Trabalhadora', description: 'Nome no perfil, para conferir com o documento.' },
      cpf: { type: 'string', example: '11144477735', description: 'CPF completo, para conferir com o documento.' },
      document_type: ref('VerificationDocumentType'),
      status: { type: 'string', enum: ['pending', 'approved', 'rejected'], example: 'pending' },
      submitted_at: isoDate,
      reviewed_at: nullableDate,
      rejection_reason: reason,
      has_document: { type: 'boolean', example: true, description: 'A foto ainda existe (só enquanto o pedido está em análise).' }
    },
    ['id', 'role', 'profile_id', 'account_id', 'name', 'cpf', 'document_type', 'status', 'submitted_at', 'reviewed_at', 'rejection_reason', 'has_document'],
    'Pedido de verificação, como a equipe vê.'
  ),
  VerificationReviewInput: input(
    { status: { type: 'string', enum: ['approved', 'rejected'], example: 'approved' }, reason },
    ['status'],
    'Decisão da equipe.'
  ),
  AdminVerificationResponse: object(
    { message: { type: 'string', example: 'Verification reviewed.' }, verification: ref('AdminVerification') },
    ['message', 'verification']
  )
} satisfies Record<VerificationSchemaName, Schema>;
