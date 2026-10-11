import type { FarmSchemaName } from '#modules/farms';
import { type Properties, type RefTo, type Schema, id, input, isoDate, nullableId, object, refTo } from '#shared/infra/docs/schema-kit';
import { CATEGORIES } from '../domain/categories';
import { SERVICE_STATUS } from '../domain/service-status';

// Schemas OpenAPI dos serviços e vagas (contrato em ../service.contract.ts). Registrados em src/docs/schemas.ts.
export type ServiceSchemaName =
  | 'ServiceStatus' | 'CategoryList'
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

const serviceProps: Properties = {
  id,
  farmer_id: id,
  farm_id: id,
  payment_id: nullableId,
  worker_id: { ...nullableId, description: 'Trabalhador aceito (null enquanto Pending).' },
  name: { type: 'string', example: 'Colheita de café' },
  description,
  category: { type: 'string', example: 'Colheita' },
  duration: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 16, description: 'Horas de trabalho.' },
  price: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 900, description: 'Valor total em R$.' },
  expires_at: lastDay,
  status: ref('ServiceStatus'),
  insertion_date: isoDate
};
const serviceRequired = ['id', 'farmer_id', 'farm_id', 'payment_id', 'worker_id', 'name', 'description', 'category', 'duration', 'price', 'expires_at', 'status', 'insertion_date'];

export const serviceSchemas = {
  ServiceStatus: { type: 'string', enum: Object.values(SERVICE_STATUS), example: 'Pending' },
  CategoryList: { type: 'array', items: { type: 'string', enum: [...CATEGORIES] }, example: [...CATEGORIES] },

  Service: object(serviceProps, serviceRequired),
  ServiceWithFarm: object({ ...serviceProps, farm: ref('Farm') }, [...serviceRequired, 'farm']),
  FarmerServiceItem: object(
    { ...serviceProps, farm: ref('Farm'), applications_pending: { type: 'integer', minimum: 0, example: 2 } },
    [...serviceRequired, 'farm', 'applications_pending']
  ),
  OpenService: object({ ...serviceProps, farm: ref('FarmLocation') }, [...serviceRequired, 'farm']),

  ServiceInput: input(
    {
      farmer_id: id,
      farm_id: id,
      name: { type: 'string', example: 'Colheita de café' },
      description: { ...description, description: 'Opcional. Vazio vira null.' },
      category: { type: 'string', example: 'Colheita', description: 'Uma das categorias de GET /api/categories.' },
      duration: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 16, description: 'Horas.' },
      price: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 900, description: 'R$.' },
      expires_at: { ...lastDay, description: 'Opcional: último dia para candidaturas (hoje ou futuro).' }
    },
    ['farmer_id', 'farm_id', 'name', 'category', 'duration', 'price'],
    'Publicação de serviço. A fazenda precisa ser ativa e do mesmo produtor.'
  ),
  ServiceUpdate: input(
    {
      farm_id: id,
      name: { type: 'string' },
      description: { ...description, description: 'null ou vazio remove a descrição.' },
      category: { type: 'string' },
      duration: { type: 'number', exclusiveMinimum: true, minimum: 0 },
      price: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 1200 },
      expires_at: { ...lastDay, description: 'Nova validade (hoje ou futuro); null remove o prazo. Renova uma vaga vencida.' }
    },
    [],
    'Edição parcial. Enviar `farmer_id`, `worker_id`, `payment_id` ou `status` resulta em 400.'
  ),

  ServiceResponse: object({ message: { type: 'string', example: 'Service requested successfully!' }, service: ref('Service') }, ['message', 'service'])
} satisfies Record<ServiceSchemaName, Schema>;
