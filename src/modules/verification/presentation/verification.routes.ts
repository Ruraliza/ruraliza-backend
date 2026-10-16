import type { AccessPolicies } from '#modules/auth';
import type { CoreSchemaName } from '#shared/infra/docs/core.schemas';
import { IMAGE_UPLOAD, TAGS, operation, pathParam, queryParam } from '#shared/infra/docs/operations';
import { type RefTo, refTo } from '#shared/infra/docs/schema-kit';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { VerificationController } from './verification.controller';
import type { VerificationSchemaName } from './verification.schemas';

const verificationOperation = operation<VerificationSchemaName | CoreSchemaName>;
const ref: RefTo<VerificationSchemaName> = refTo;
const requestId = pathParam('id', 'ID do pedido de verificação.');

const HOW =
  'A equipe confere o nome e o CPF do documento com os do perfil. A foto é reduzida para no máximo 1600px, ' +
  'perde os metadados, fica num armazenamento privado (fora de /api/images) e é apagada logo depois da decisão. ' +
  'Reenviar substitui a foto anterior; com o selo valendo, não há o que enviar (409).';

function profileRoutes(
  role: 'produtor' | 'trabalhador',
  get: VerificationController['farmerVerification'],
  submit: VerificationController['submitFarmerVerification'],
  access: ReturnType<AccessPolicies['ownFarmer']>
): RouteDef[] {
  const tag = role === 'produtor' ? TAGS.farmers : TAGS.workers;
  const profileId = pathParam('id', `ID do ${role}.`);
  return [
    route('get', '/:id/verification', get, verificationOperation({
      tag,
      summary: `Verificação de identidade do ${role}`,
      description: '`verified` diz se o selo aparece para os outros. Sem pedido, `status: none`.',
      params: [profileId],
      success: { status: 200, description: 'Situação da verificação.', schema: 'Verification' },
      errors: { 404: 'Perfil não encontrado.' }
    }), access),

    route('post', '/:id/verification', submit, verificationOperation({
      tag,
      summary: `Enviar documento para verificação (${role})`,
      description: `A foto da frente do RG ou da CNH no corpo (Content-Type image/*) e o tipo em \`?document_type=\`. ${HOW}`,
      params: [profileId, queryParam('document_type', 'Documento da foto (obrigatório).', ref('VerificationDocumentType'))],
      body: IMAGE_UPLOAD,
      success: { status: 201, description: 'Pedido na fila da equipe (`status: pending`).', schema: 'VerificationResponse' },
      errors: {
        400: '`document_type` faltando ou inválido; corpo vazio ou que não é uma imagem legível.',
        404: 'Perfil não encontrado.',
        409: 'O perfil já está verificado.',
        413: 'Arquivo maior que 10 MB.'
      }
    }), access)
  ];
}

export interface VerificationRoutes {
  farmer: readonly RouteDef[]; // em /api/farmers (antes de '/:id')
  worker: readonly RouteDef[]; // em /api/workers (antes de '/:id')
  admin: readonly RouteDef[]; // em /api/admin (equipe com a permissão moderation:manage)
}

export function verificationRoutes(verification: VerificationController, access: AccessPolicies): VerificationRoutes {
  const moderate = access.system('moderation:manage');
  return {
    farmer: profileRoutes('produtor', verification.farmerVerification, verification.submitFarmerVerification, access.ownFarmer()),
    worker: profileRoutes('trabalhador', verification.workerVerification, verification.submitWorkerVerification, access.ownWorker()),
    admin: [
      route('get', '/verifications', verification.listVerifications, verificationOperation({
        tag: TAGS.moderation,
        summary: 'Fila de verificações',
        description: 'O envio mais antigo primeiro, com o nome e o CPF completos do perfil para conferir com o documento.',
        params: [queryParam('status', 'Filtra pela situação (sem ele, todas).', { type: 'string', enum: ['pending', 'approved', 'rejected'] })],
        success: { status: 200, description: 'Pedidos.', schema: { listOf: 'AdminVerification' } },
        errors: { 400: 'Status inválido.' }
      }), moderate),

      route('get', '/verifications/:id/document', verification.getVerificationDocument, verificationOperation({
        tag: TAGS.moderation,
        summary: 'Foto do documento',
        description: 'Só enquanto o pedido está em análise (`has_document`); não fica em cache. Busque com o token de sistema no cabeçalho.',
        params: [requestId],
        success: { status: 200, description: 'Bytes da imagem.', binary: 'image/webp' },
        errors: { 404: 'Pedido não encontrado, ou a foto já foi apagada.' }
      }), moderate),

      route('patch', '/verifications/:id', verification.reviewVerification, verificationOperation({
        tag: TAGS.moderation,
        summary: 'Decidir verificação',
        description:
          'Aprovado: o perfil ganha o selo (e o outro perfil da conta também, se tiver o mesmo CPF). Recusado: o motivo vai para a pessoa. ' +
          'Nos dois casos a foto do documento é apagada e a pessoa recebe uma notificação.',
        params: [requestId],
        body: 'VerificationReviewInput',
        success: { status: 200, description: 'Decisão registrada.', schema: 'AdminVerificationResponse' },
        errors: { 400: '`status` inválido; recusa sem motivo; motivo longo demais.', 404: 'Pedido ou perfil não encontrado.', 409: 'O pedido já foi decidido.' }
      }), moderate)
    ]
  };
}
