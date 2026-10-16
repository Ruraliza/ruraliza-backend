import type { ReviewSchemaName } from '#modules/reviews';
import type { ServiceSchemaName } from '#modules/services';
import { type Properties, type RefTo, type Schema, id, input, isoDate, object, refTo } from '#shared/infra/docs/schema-kit';
import { APPLICATION_STATUS, PAYMENT_STATUS } from '../domain/hiring-status';

// Schemas OpenAPI da contratação (contrato em ../hiring.contract.ts). Registrados em src/docs/schemas.ts.
export type HiringSchemaName =
  | 'ApplicationStatus' | 'PaymentStatus' | 'AnalyzeAction'
  | 'ServiceApplication' | 'ApplicationWithWorker' | 'ApplicationWithService' | 'Payment'
  | 'AnalyzeInput' | 'WorkerActionInput'
  | 'ApplicationResponse' | 'AnalyzeResponse' | 'PaymentResponse';

// 'Worker' ainda é do registro legado (sai quando o módulo de trabalhadores migrar).
const ref: RefTo<HiringSchemaName | ServiceSchemaName | ReviewSchemaName | 'Worker'> = refTo;

const applicationProps: Properties = {
  id,
  service_id: id,
  worker_id: id,
  status: ref('ApplicationStatus'),
  auto_rejected: { type: 'boolean', description: 'Recusada pelo aceite de outro candidato; volta a Pending se o aceito desistir.' },
  insertion_date: isoDate
};
const applicationRequired = ['id', 'service_id', 'worker_id', 'status', 'insertion_date'];

export const hiringSchemas = {
  ApplicationStatus: { type: 'string', enum: Object.values(APPLICATION_STATUS), example: 'Pending' },
  PaymentStatus: { type: 'string', enum: Object.values(PAYMENT_STATUS) },
  AnalyzeAction: { type: 'string', enum: ['Accept', 'Reject'] },
  ServiceApplication: object(applicationProps, applicationRequired),
  ApplicationWithWorker: object(
    {
      ...applicationProps, worker: ref('Worker'), reputation: ref('WorkerReputation'),
      verified: { type: 'boolean', example: true, description: 'Identidade conferida pela equipe (selo de verificado).' }
    },
    [...applicationRequired, 'worker', 'reputation', 'verified'],
    'CPF, telefone e e-mail do trabalhador vêm mascarados: o contato só é trocado pela conversa, quando os dois liberam o WhatsApp.'
  ),
  ApplicationWithService: object({ ...applicationProps, service: ref('OpenService') }, [...applicationRequired, 'service']),
  Payment: object(
    {
      id,
      service_id: id,
      farmer_id: id,
      worker_id: id,
      value: { type: 'number', example: 900 },
      status: ref('PaymentStatus'),
      insertion_date: isoDate
    },
    ['id', 'service_id', 'farmer_id', 'worker_id', 'value', 'status', 'insertion_date'],
    'Pagamento simulado: nenhum dinheiro é movimentado.'
  ),
  AnalyzeInput: input(
    { application_id: id, action: ref('AnalyzeAction') },
    ['application_id', 'action'],
    'Accept: o serviço passa a In Progress e as demais candidaturas pendentes são recusadas.'
  ),
  WorkerActionInput: input({ worker_id: id }, ['worker_id'], 'Trabalhador que executa a ação.'),
  ApplicationResponse: object(
    { message: { type: 'string', example: 'Application sent successfully!' }, application: ref('ServiceApplication') },
    ['message', 'application']
  ),
  AnalyzeResponse: object(
    {
      message: { type: 'string', example: 'Worker accepted successfully. Service is now in progress!' },
      application: ref('ServiceApplication'),
      service: { allOf: [ref('Service')], description: 'Só no Accept.' }
    },
    ['message', 'application']
  ),
  PaymentResponse: object(
    { message: { type: 'string', example: 'Payment released and service completed successfully!' }, service: ref('Service'), payment: ref('Payment') },
    ['message', 'service', 'payment']
  )
} satisfies Record<HiringSchemaName, Schema>;
