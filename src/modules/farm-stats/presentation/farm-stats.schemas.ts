import { type RefTo, type Schema, id, isoDate, object, refTo } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI do painel da fazenda (contrato em ../farm-stats.contract.ts). Registrados em src/docs/schemas.ts.
export type FarmStatsSchemaName = 'FarmerStatsRating' | 'FarmerStatsMonth' | 'FarmerStatsCategory' | 'FarmerStatsPerson' | 'FarmerStats';

const ref: RefTo<FarmStatsSchemaName> = refTo;
const count: Schema = { type: 'integer', minimum: 0, example: 3 };
const hours: Schema = { type: 'number', minimum: 0, example: 64, description: 'Horas dos serviços concluídos.' };
const money: Schema = { type: 'number', minimum: 0, example: 2580, description: 'R$.' };
const score = (example: number | null): Schema => ({ type: 'number', minimum: 1, maximum: 5, nullable: true, example });

// Nomeado para a documentação e repetido com nullable em FarmerStats.rating (o $ref não aceita nullable ao lado).
const rating: Schema = object(
  { average: { type: 'number', minimum: 1, maximum: 5, example: 4.5 }, count, infrastructure: score(4.6), conditions: score(4.4), as_described: score(4.5) },
  ['average', 'count', 'infrastructure', 'conditions', 'as_described'],
  'Média das avaliações publicadas das fazendas do produtor, pesada pela quantidade de cada fazenda.'
);

export const farmStatsSchemas = {
  FarmerStatsRating: rating,
  FarmerStatsMonth: object(
    { month: { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}$', example: '2026-10' }, services: count, hours, paid: money },
    ['month', 'services', 'hours', 'paid']
  ),
  FarmerStatsCategory: object({ category: { type: 'string', example: 'Colheita' }, services: count, hours }, ['category', 'services', 'hours']),
  FarmerStatsPerson: object(
    {
      worker_id: id,
      name: { type: 'string', example: 'Maria Trabalhadora', description: '`(perfil removido)` se não existe mais.' },
      photo_url: { type: 'string', nullable: true, example: null },
      services: count,
      hours,
      last_service_at: { ...isoDate, description: 'O último pagamento.' }
    },
    ['worker_id', 'name', 'photo_url', 'services', 'hours', 'last_service_at'],
    'Quem já concluiu serviço com o produtor.'
  ),
  FarmerStats: object(
    {
      services_completed: count,
      hours_completed: hours,
      total_paid: money,
      people_count: { ...count, description: 'Pessoas diferentes que já concluíram serviço.' },
      returning_people: { ...count, description: 'Dessas, as que voltaram (2 serviços ou mais).' },
      rating: { ...rating, nullable: true, description: 'Nota das fazendas (null sem avaliação publicada).' },
      open_jobs: { ...count, description: 'Vagas recebendo candidaturas agora.' },
      pending_applications: { ...count, description: 'Candidaturas esperando resposta.' },
      months: { type: 'array', items: ref('FarmerStatsMonth'), minItems: 6, maxItems: 6, description: 'Os últimos 6 meses, do mais antigo para o atual.' },
      categories: { type: 'array', items: ref('FarmerStatsCategory'), description: 'Mais horas primeiro.' },
      people: { type: 'array', items: ref('FarmerStatsPerson'), maxItems: 20, description: 'O mais recente primeiro.' }
    },
    ['services_completed', 'hours_completed', 'total_paid', 'people_count', 'returning_people', 'rating', 'open_jobs', 'pending_applications', 'months', 'categories', 'people'],
    'Os números do produtor, em todas as fazendas dele.'
  )
} satisfies Record<FarmStatsSchemaName, Schema>;
