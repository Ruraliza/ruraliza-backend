import type { AccessPolicies } from '#modules/auth';
import type { CoreSchemaName } from '#shared/infra/docs/core.schemas';
import { TAGS, operation, pathParam, queryParam } from '#shared/infra/docs/operations';
import { type RefTo, refTo } from '#shared/infra/docs/schema-kit';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { ReportController } from './report.controller';
import type { ReportSchemaName } from './report.schemas';

const reportOperation = operation<ReportSchemaName | CoreSchemaName>;
const ref: RefTo<ReportSchemaName> = refTo;

const RULES =
  'Uma pessoa só pode ser denunciada por quem teve contato com ela (candidatura a um serviço). ' +
  'Enquanto a equipe analisa, a mesma pessoa não denuncia o mesmo alvo de novo. Quem foi denunciado não fica sabendo quem denunciou.';

export interface ReportRoutes {
  farmer: readonly RouteDef[]; // em /api/farmers (antes de '/:id')
  worker: readonly RouteDef[]; // em /api/workers (antes de '/:id')
  admin: readonly RouteDef[]; // em /api/admin (equipe com a permissão moderation:manage)
}

export function reportRoutes(reports: ReportController, access: AccessPolicies): ReportRoutes {
  const moderate = access.system('moderation:manage');
  return {
    farmer: [
      route('post', '/:id/reports', reports.farmerReport, reportOperation({
        tag: TAGS.moderation,
        summary: 'Denunciar trabalhador',
        description: `O produtor denuncia um trabalhador (\`target_type: worker\`) que se candidatou a um serviço dele. ${RULES}`,
        params: [pathParam('id', 'ID do produtor.')],
        body: 'ReportInput',
        success: { status: 201, description: 'Denúncia enviada para a equipe.', schema: 'ReportResponse' },
        errors: {
          400: 'Campo faltando ou inválido; alvo que o produtor não denuncia; relato obrigatório no motivo `outro`; o próprio perfil.',
          403: 'O trabalhador não se candidatou a nenhum serviço do produtor.',
          404: 'Trabalhador não encontrado.',
          409: 'Já existe uma denúncia dele em análise para este trabalhador.'
        }
      }), access.ownFarmer())
    ],
    worker: [
      route('post', '/:id/reports', reports.workerReport, reportOperation({
        tag: TAGS.moderation,
        summary: 'Denunciar vaga ou produtor',
        description:
          'O trabalhador denuncia uma vaga (`target_type: service`; qualquer vaga, mesmo sem candidatura) ou um produtor ' +
          `(\`target_type: farmer\`). ${RULES}`,
        params: [pathParam('id', 'ID do trabalhador.')],
        body: 'ReportInput',
        success: { status: 201, description: 'Denúncia enviada para a equipe.', schema: 'ReportResponse' },
        errors: {
          400: 'Campo faltando ou inválido; alvo que o trabalhador não denuncia; relato obrigatório no motivo `outro`; a própria vaga ou o próprio perfil.',
          403: 'O trabalhador não se candidatou a nenhuma vaga do produtor.',
          404: 'Vaga ou produtor não encontrado.',
          409: 'Já existe uma denúncia dele em análise para este alvo.'
        }
      }), access.ownWorker())
    ],
    admin: [
      route('get', '/reports', reports.listReports, reportOperation({
        tag: TAGS.moderation,
        summary: 'Fila de denúncias',
        description: 'A mais recente primeiro, com os nomes e as contas de quem denunciou e do alvo.',
        params: [queryParam('status', 'Filtra pela situação (sem ele, todas).', ref('ReportStatus'))],
        success: { status: 200, description: 'Denúncias.', schema: { listOf: 'AdminReport' } },
        errors: { 400: 'Status inválido.' }
      }), moderate),

      route('patch', '/reports/:id', reports.reviewReport, reportOperation({
        tag: TAGS.moderation,
        summary: 'Decidir denúncia',
        description:
          'Procedente (`resolved`) ou descartada (`dismissed`), com uma anotação interna opcional. Quem denunciou recebe uma ' +
          'notificação com o resultado (sem a anotação). Remover a conta ou editar o perfil é feito em /api/admin/users.',
        params: [pathParam('id', 'ID da denúncia.')],
        body: 'ReportReviewInput',
        success: { status: 200, description: 'Decisão registrada.', schema: 'AdminReportResponse' },
        errors: { 400: '`status` inválido; anotação longa demais.', 404: 'Denúncia não encontrada.', 409: 'A denúncia já foi analisada.' }
      }), moderate)
    ]
  };
}
