import { type RefTo, type Schema, id, input, isoDate, nullableId, object, refTo } from '#shared/infra/docs/schema-kit';
import { REPORT_DETAILS_MAX_LENGTH, REPORT_NOTE_MAX_LENGTH, REPORT_REASONS, REPORT_STATUSES, REPORT_TARGET_TYPES } from '../domain/report';

// Schemas OpenAPI das denúncias (contrato em ../report.contract.ts). Registrados em src/docs/schemas.ts.
export type ReportSchemaName =
  | 'ReportTargetType'
  | 'ReportReason'
  | 'ReportStatus'
  | 'ReportInput'
  | 'Report'
  | 'ReportResponse'
  | 'ReportParty'
  | 'AdminReport'
  | 'ReportReviewInput'
  | 'AdminReportResponse';

const ref: RefTo<ReportSchemaName> = refTo;

const details: Schema = {
  type: 'string', maxLength: REPORT_DETAILS_MAX_LENGTH, nullable: true, example: 'A vaga pede um depósito antes de começar.',
  description: 'O que aconteceu, com as palavras de quem denuncia. Obrigatório quando o motivo é `outro`. Só a equipe lê.'
};
const note: Schema = {
  type: 'string', maxLength: REPORT_NOTE_MAX_LENGTH, nullable: true, example: 'Conta removida.', description: 'Anotação interna da equipe; quem denunciou não vê.'
};

const reportProps = {
  id,
  target_type: ref('ReportTargetType'),
  target_id: id,
  reason: ref('ReportReason'),
  details,
  status: ref('ReportStatus'),
  insertion_date: isoDate
};
const reportRequired = ['id', 'target_type', 'target_id', 'reason', 'details', 'status', 'insertion_date'];

export const reportSchemas = {
  ReportTargetType: {
    type: 'string', enum: [...REPORT_TARGET_TYPES], example: 'service',
    description: 'O que é denunciado: `service` (vaga) e `farmer` (produtor), pelo trabalhador; `worker` (trabalhador), pelo produtor.'
  },
  ReportReason: {
    type: 'string', enum: [...REPORT_REASONS], example: 'fraude',
    description: '`fraude` (vaga falsa ou golpe), `condicoes` (condições de trabalho ruins ou perigosas), `comportamento` (assédio, ' +
      'ameaça, não cumpriu o combinado), `ofensivo` (conteúdo ofensivo) ou `outro`.'
  },
  ReportStatus: {
    type: 'string', enum: [...REPORT_STATUSES], example: 'open',
    description: '`open` (em análise), `resolved` (procedente: a equipe tomou providências) ou `dismissed` (descartada).'
  },
  ReportInput: input({ target_type: ref('ReportTargetType'), target_id: id, reason: ref('ReportReason'), details }, ['target_type', 'target_id', 'reason'], 'Denúncia nova.'),
  Report: object(reportProps, reportRequired, 'Denúncia, como quem denunciou vê.'),
  ReportResponse: object({ message: { type: 'string', example: 'Report sent successfully!' }, report: ref('Report') }, ['message', 'report']),
  ReportParty: object(
    {
      role: { type: 'string', enum: ['farmer', 'worker'], example: 'worker' },
      profile_id: id,
      name: { type: 'string', example: 'Maria', description: '`(perfil removido)` se o perfil não existe mais.' },
      account_id: { ...nullableId, description: 'Conta, para abrir em GET /api/admin/users/{id} (null = perfil removido).' }
    },
    ['role', 'profile_id', 'name', 'account_id'],
    'Quem denunciou.'
  ),
  AdminReport: object(
    {
      ...reportProps,
      reporter: ref('ReportParty'),
      target_name: { type: 'string', example: 'Colheita de café', description: 'Nome da vaga ou da pessoa (`(removido)` se não existe mais).' },
      target_account_id: { ...nullableId, description: 'Conta responsável pelo alvo (a do produtor, no caso de uma vaga).' },
      resolution_note: note,
      reviewed_at: { ...isoDate, nullable: true, example: null }
    },
    [...reportRequired, 'reporter', 'target_name', 'target_account_id', 'resolution_note', 'reviewed_at'],
    'Denúncia, como a equipe vê.'
  ),
  ReportReviewInput: input(
    { status: { type: 'string', enum: ['resolved', 'dismissed'], example: 'resolved' }, note },
    ['status'],
    'Decisão da equipe.'
  ),
  AdminReportResponse: object({ message: { type: 'string', example: 'Report reviewed successfully!' }, report: ref('AdminReport') }, ['message', 'report'])
} satisfies Record<ReportSchemaName, Schema>;
