import type { FarmSchemaName } from '#modules/farms';
import { type Properties, type RefTo, type Schema, id, input, isoDate, nullableId, object, refTo } from '#shared/infra/docs/schema-kit';
import { CATEGORIES, CATEGORY_GROUPS, CATEGORY_GROUP_NAMES } from '../domain/categories';
import { PRICE_UNITS } from '../domain/agreement';
import { SERVICE_STATUS } from '../domain/service-status';

// Schemas OpenAPI dos serviços e vagas (contrato em ../service.contract.ts). Registrados em src/docs/schemas.ts.
export type ServiceSchemaName =
  | 'ServiceStatus' | 'PriceUnit' | 'AgreementTerms' | 'ServiceAgreement' | 'ServicePayment' | 'CategoryList' | 'CategoryGroup' | 'CategoryGroupList'
  | 'Service' | 'ServiceWithFarm' | 'FarmerServiceItem' | 'OpenService'
  | 'ServiceInput' | 'ServiceUpdate' | 'ServiceResponse';

const ref: RefTo<ServiceSchemaName | FarmSchemaName> = refTo;

const lastDay: Schema = {
  type: 'string',
  format: 'date',
  nullable: true,
  example: '2026-10-31',
  description: 'Último dia (horário de Brasília) para receber candidaturas. null = sem prazo. Vencida, a vaga sai da busca e não aceita candidaturas, mas continua Pending: dá para renovar a data ou cancelar.'
};
const description: Schema = { type: 'string', nullable: true, maxLength: 2000, example: 'Colheita manual de café. Levar luvas e chapéu; almoço por conta da fazenda.' };

const priceUnitSchema: Schema = { type: 'string', enum: [...PRICE_UNITS], example: 'day', description: 'hour, day, meter, hectare ou fixed (empreitada, valor fechado).' };
const priceSchema: Schema = { type: 'number', exclusiveMinimum: true, minimum: 0, example: 150 };
// Também aparece como `nullable` em OpenService.payment.
const servicePaymentSchema: Schema = object(
  { value: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 900, description: 'Total em R$ informado pelo produtor.' }, paid_at: isoDate },
  ['value', 'paid_at'],
  'Pagamento (simulado) liberado pelo produtor. Nenhum dinheiro é movimentado.'
);

// Os termos de uma proposta (e do combinado no serviço).
export const agreementTermsProps: Properties = {
  amount: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 150, description: 'R$, maior que zero, por `unit`.' },
  unit: ref('PriceUnit'),
  notes: { type: 'string', nullable: true, maxLength: 300, example: 'Almoço por conta da fazenda.', description: 'Telefone e e-mail saem ocultos.' }
};
export const agreementTermsRequired: readonly string[] = ['amount', 'unit', 'notes'];
// Também aparece como `nullable` em Service.agreement (allOf + nullable não aceita null).
const serviceAgreementSchema: Schema = object(
  { ...agreementTermsProps, agreed_at: isoDate },
  [...agreementTermsRequired, 'agreed_at'],
  'Cópia da proposta aceita. O pagamento é liberado pelo produtor no app, no fim do serviço.'
);

const serviceProps: Properties = {
  id,
  farmer_id: id,
  farm_id: id,
  payment_id: { ...nullableId, description: 'Pagamento (simulado) que concluiu o serviço.' },
  worker_id: { ...nullableId, description: 'Trabalhador aceito (null enquanto Pending).' },
  proposal_id: { ...nullableId, description: 'Proposta aceita que valeu no aceite. null para quem não é o produtor nem o trabalhador aceito.' },
  agreement: { ...serviceAgreementSchema, nullable: true, description: 'O combinado da proposta aceita (valor e unidade). Só para o produtor e o trabalhador aceito.' },
  name: { type: 'string', example: 'Colheita de café' },
  description,
  category: { type: 'string', example: 'Colheita' },
  duration: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 16, description: 'Horas de trabalho (estimativa).' },
  price: { ...priceSchema, nullable: true, description: 'Estimativa do produtor em R$ por `price_unit`. null nas vagas antigas (valor a combinar). O valor final é combinado na conversa.' },
  price_unit: { ...priceUnitSchema, nullable: true },
  expires_at: lastDay,
  status: ref('ServiceStatus'),
  completed_at: { ...isoDate, nullable: true, description: 'Quando o produtor liberou o pagamento e o serviço foi concluído.' },
  insertion_date: isoDate
};
const serviceRequired = ['id', 'farmer_id', 'farm_id', 'payment_id', 'worker_id', 'proposal_id', 'agreement', 'name', 'description', 'category', 'duration', 'price', 'price_unit', 'expires_at', 'status', 'completed_at', 'insertion_date'];

// Campos da vaga como o trabalhador vê (OpenService), para quem estende (ex.: RecommendedJob).
export const openServiceProps: Properties = {
  ...serviceProps, farm: ref('FarmLocation'),
  payment: { ...servicePaymentSchema, nullable: true, description: 'O pagamento liberado (valor e data). Só para o trabalhador aceito.' }
};
export const openServiceRequired: readonly string[] = [...serviceRequired, 'farm', 'payment'];

export const serviceSchemas = {
  ServiceStatus: { type: 'string', enum: Object.values(SERVICE_STATUS), example: 'Pending' },
  PriceUnit: priceUnitSchema,
  ServicePayment: servicePaymentSchema,
  AgreementTerms: object(agreementTermsProps, agreementTermsRequired),
  ServiceAgreement: serviceAgreementSchema,
  CategoryList: { type: 'array', items: { type: 'string', enum: [...CATEGORIES] }, example: [...CATEGORIES] },
  CategoryGroup: object(
    {
      name: { type: 'string', enum: [...CATEGORY_GROUP_NAMES], example: 'Água' },
      services: { type: 'array', minItems: 1, items: { type: 'string', enum: [...CATEGORIES] }, example: [...(CATEGORY_GROUPS[2]?.services ?? [])] }
    },
    ['name', 'services']
  ),
  CategoryGroupList: { type: 'array', items: ref('CategoryGroup'), example: CATEGORY_GROUPS.map((g) => ({ name: g.name, services: [...g.services] })) },

  Service: object(serviceProps, serviceRequired),
  ServiceWithFarm: object({ ...serviceProps, farm: ref('Farm') }, [...serviceRequired, 'farm']),
  FarmerServiceItem: object(
    { ...serviceProps, farm: ref('Farm'), applications_pending: { type: 'integer', minimum: 0, example: 2 } },
    [...serviceRequired, 'farm', 'applications_pending']
  ),
  OpenService: object(openServiceProps, openServiceRequired),

  ServiceInput: input(
    {
      farmer_id: id,
      farm_id: id,
      name: { type: 'string', example: 'Colheita de café' },
      description: { ...description, description: 'Opcional. Vazio vira null.' },
      category: { type: 'string', enum: [...CATEGORIES], example: 'Colheita', description: 'Uma das categorias de GET /api/categories (o serviço, não o grupo).' },
      duration: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 16, description: 'Horas estimadas.' },
      price: { ...priceSchema, description: 'Estimativa em R$, maior que zero, por `price_unit`. O valor final é combinado na conversa.' },
      price_unit: priceUnitSchema,
      expires_at: { ...lastDay, description: 'Opcional: último dia para candidaturas (hoje ou futuro).' }
    },
    ['farmer_id', 'farm_id', 'name', 'category', 'duration', 'price', 'price_unit'],
    'Publicação de serviço. A fazenda precisa ser ativa e do mesmo produtor. O valor é uma estimativa; o final é combinado na conversa, por propostas.'
  ),
  ServiceUpdate: input(
    {
      farm_id: id,
      name: { type: 'string' },
      description: { ...description, description: 'null ou vazio remove a descrição.' },
      category: { type: 'string', enum: [...CATEGORIES], description: 'Uma das categorias de GET /api/categories.' },
      duration: { type: 'number', exclusiveMinimum: true, minimum: 0 },
      price: { ...priceSchema, description: 'Nova estimativa; vem junto com `price_unit`.' },
      price_unit: { ...priceUnitSchema, description: 'Vem junto com `price`.' },
      expires_at: { ...lastDay, description: 'Nova validade (hoje ou futuro); null remove o prazo. Renova uma vaga vencida.' }
    },
    [],
    'Edição parcial. Enviar `farmer_id`, `worker_id` ou `status` resulta em 400.'
  ),

  ServiceResponse: object({ message: { type: 'string', example: 'Service requested successfully!' }, service: ref('Service') }, ['message', 'service'])
} satisfies Record<ServiceSchemaName, Schema>;
