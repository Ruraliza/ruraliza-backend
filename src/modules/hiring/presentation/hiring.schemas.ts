import type { ReviewSchemaName } from '#modules/reviews';
import { type ServiceSchemaName, agreementTermsProps, agreementTermsRequired } from '#modules/services';
import { type Properties, type RefTo, type Schema, id, input, isoDate, object, refTo } from '#shared/infra/docs/schema-kit';
import { APPLICATION_STATUS, INVITE_STATUS, PAYMENT_STATUS, PROPOSAL_STATUS } from '../domain/hiring-status';
import { MAX_HIRING_NOTE } from '../domain/hiring.rules';

// Schemas OpenAPI da contratação (contrato em ../hiring.contract.ts). Registrados em src/docs/schemas.ts.
export type HiringSchemaName =
  | 'ApplicationStatus' | 'PaymentStatus' | 'AnalyzeAction' | 'ProposalStatus' | 'ProposalSide' | 'ProposalAnswer'
  | 'Proposal' | 'ProposalInput' | 'ProposalAnswerInput' | 'ProposalResponse'
  | 'ServiceApplication' | 'ApplicationWithWorker' | 'ApplicationWithService' | 'Payment' | 'PaymentInput'
  | 'AnalyzeInput' | 'WorkerActionInput' | 'ApplyInput'
  | 'ApplicationResponse' | 'AnalyzeResponse' | 'PaymentResponse'
  | 'InviteStatus' | 'Invite' | 'InviteInput' | 'InviteResponse' | 'InviteWithService' | 'InviteAnswer' | 'InviteAnswerInput' | 'InviteAnswerResponse';

// 'Worker' ainda é do registro legado (sai quando o módulo de trabalhadores migrar).
const ref: RefTo<HiringSchemaName | ServiceSchemaName | ReviewSchemaName | 'Worker'> = refTo;

const applicationProps: Properties = {
  id,
  service_id: id,
  worker_id: id,
  status: ref('ApplicationStatus'),
  auto_rejected: { type: 'boolean', description: 'Recusada pelo aceite de outro candidato; volta a Pending se o aceito desistir.' },
  message: { type: 'string', maxLength: MAX_HIRING_NOTE, example: 'Já colhi café 3 safras, posso a partir de segunda.', description: 'Apresentação do trabalhador. Telefone e e-mail saem como `[número oculto]` e `[e-mail oculto]`.' },
  invited: { type: 'boolean', example: false, description: 'Nasceu de um convite do produtor (etiqueta "Convidado").' },
  insertion_date: isoDate
};
const applicationRequired = ['id', 'service_id', 'worker_id', 'status', 'invited', 'insertion_date'];

const inviteProps: Properties = {
  id, service_id: id, farmer_id: id, worker_id: id, status: ref('InviteStatus'), insertion_date: isoDate,
  answered_at: { ...isoDate, nullable: true, description: 'Quando foi aceito ou recusado.' }
};
const inviteRequired = ['id', 'service_id', 'farmer_id', 'worker_id', 'status', 'insertion_date', 'answered_at'];

// Também aparece como `nullable` em ApplicationWithWorker.accepted_proposal (allOf + nullable não aceita null).
const proposalSchema: Schema = object(
  {
    id, application_id: id, service_id: id, farmer_id: id, worker_id: id, ...agreementTermsProps,
    proposed_by: ref('ProposalSide'), status: ref('ProposalStatus'), insertion_date: isoDate,
    answered_at: { ...isoDate, nullable: true, description: 'Quando foi aceita ou recusada.' }
  },
  ['id', 'application_id', 'service_id', 'farmer_id', 'worker_id', ...agreementTermsRequired, 'proposed_by', 'status', 'insertion_date', 'answered_at'],
  'Proposta de valor (por unidade) feita na conversa da candidatura.'
);

export const hiringSchemas = {
  ApplicationStatus: { type: 'string', enum: Object.values(APPLICATION_STATUS), example: 'Pending' },
  PaymentStatus: { type: 'string', enum: Object.values(PAYMENT_STATUS) },
  AnalyzeAction: { type: 'string', enum: ['Accept', 'Reject'] },
  ProposalStatus: { type: 'string', enum: Object.values(PROPOSAL_STATUS), example: 'Pending' },
  ProposalSide: { type: 'string', enum: ['farmer', 'worker'] },
  ProposalAnswer: { type: 'string', enum: ['Accept', 'Decline'] },
  Proposal: proposalSchema,
  ProposalInput: input(
    { ...agreementTermsProps, notes: { type: 'string', nullable: true, maxLength: MAX_HIRING_NOTE, example: 'Almoço por conta da fazenda.', description: 'Opcional. Sem palavrões; telefone e e-mail saem ocultos.' } },
    ['amount', 'unit'],
    'Valor (R$, maior que zero, por unidade) e unidade. A primeira proposta costuma partir da estimativa da vaga.'
  ),
  ProposalAnswerInput: input({ action: ref('ProposalAnswer') }, ['action'], 'Accept aceita a proposta; Decline recusa.'),
  ProposalResponse: object({ message: { type: 'string', example: 'Proposal sent.' }, proposal: ref('Proposal') }, ['message', 'proposal']),
  ServiceApplication: object(applicationProps, applicationRequired),
  ApplicationWithWorker: object(
    {
      ...applicationProps, worker: ref('Worker'), reputation: ref('WorkerReputation'),
      accepted_proposal: { ...proposalSchema, nullable: true, description: 'A proposta aceita pelos dois na conversa. Sem ela, o aceite não passa.' },
      verified: { type: 'boolean', example: true, description: 'Identidade conferida pela equipe (selo de verificado).' }
    },
    [...applicationRequired, 'worker', 'reputation', 'verified', 'accepted_proposal'],
    'CPF, telefone e e-mail do trabalhador vêm mascarados: o contato só é trocado pela conversa, quando os dois liberam o WhatsApp.'
  ),
  ApplicationWithService: object({ ...applicationProps, service: ref('OpenService') }, [...applicationRequired, 'service']),
  AnalyzeInput: input(
    { application_id: id, action: ref('AnalyzeAction') },
    ['application_id', 'action'],
    'Accept: o serviço passa a In Progress e as demais candidaturas pendentes são recusadas.'
  ),
  WorkerActionInput: input({ worker_id: id }, ['worker_id'], 'Trabalhador que executa a ação.'),
  ApplyInput: input(
    {
      worker_id: id,
      message: { type: 'string', nullable: true, maxLength: MAX_HIRING_NOTE, example: 'Já colhi café 3 safras, posso a partir de segunda.', description: 'Opcional. Sem palavrões; telefone e e-mail saem ocultos.' }
    },
    ['worker_id'],
    'Candidatura, com uma mensagem opcional para o produtor.'
  ),
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
  Payment: object(
    { id, service_id: id, farmer_id: id, worker_id: id, value: { type: 'number', example: 900 }, status: ref('PaymentStatus'), insertion_date: isoDate },
    ['id', 'service_id', 'farmer_id', 'worker_id', 'value', 'status', 'insertion_date'],
    'Pagamento simulado: nenhum dinheiro é movimentado.'
  ),
  PaymentInput: input(
    { value: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 900, description: 'Total em R$, maior que zero.' } },
    ['value'],
    'O total que o produtor libera. O app sugere a partir da proposta aceita.'
  ),
  PaymentResponse: object(
    { message: { type: 'string', example: 'Payment released and service completed successfully!' }, service: ref('Service'), payment: ref('Payment') },
    ['message', 'service', 'payment']
  ),
  InviteStatus: { type: 'string', enum: Object.values(INVITE_STATUS), example: 'Pending' },
  Invite: object(inviteProps, inviteRequired, 'Convite do produtor a um trabalhador do catálogo da vaga.'),
  InviteInput: input({ worker_id: id }, ['worker_id'], 'Quem convidar (um trabalhador do catálogo da vaga).'),
  InviteResponse: object({ message: { type: 'string', example: 'Invite sent.' }, invite: ref('Invite') }, ['message', 'invite']),
  InviteWithService: object({ ...inviteProps, service: ref('OpenService') }, [...inviteRequired, 'service']),
  InviteAnswer: { type: 'string', enum: ['Accept', 'Decline'] },
  InviteAnswerInput: input({ action: ref('InviteAnswer') }, ['action'], 'Accept vira candidato, com a conversa aberta; Decline recusa.'),
  InviteAnswerResponse: object(
    {
      message: { type: 'string', example: 'Invite accepted.' },
      invite: ref('Invite'),
      application: { allOf: [ref('ServiceApplication')], description: 'Só no Accept: a candidatura criada.' },
      chat_id: { ...id, description: 'Só no Accept: a conversa aberta com o produtor.' }
    },
    ['message', 'invite']
  )
} satisfies Record<HiringSchemaName, Schema>;
