import type { ReviewSchemaName } from '#modules/reviews';
import { openServiceProps, openServiceRequired } from '#modules/services';
import { type RefTo, type Schema, id, latitude, longitude, object, refTo } from '#shared/infra/docs/schema-kit';
import { RADIUS_MAX_KM, RADIUS_MIN_KM } from '../domain/job-preferences';

// Schemas OpenAPI das vagas para você (contrato em ../matching.contract.ts). Registrados em src/docs/schemas.ts.
export type MatchingSchemaName = 'JobPreferencesNear' | 'JobPreferences' | 'JobPreferencesResponse' | 'RecommendedJob' | 'CatalogWorker';

const ref: RefTo<MatchingSchemaName | ReviewSchemaName> = refTo;

// "Perto de mim": nomeado para a documentação e repetido com nullable em JobPreferences (o $ref não aceita nullable ao lado).
const nearSchema: Schema = object(
  {
    latitude: { ...latitude, description: 'Guardada com 2 casas decimais (cerca de 1 km).' },
    longitude: { ...longitude, description: 'Guardada com 2 casas decimais (cerca de 1 km).' },
    radius_km: { type: 'number', minimum: RADIUS_MIN_KM, maximum: RADIUS_MAX_KM, example: 30, description: 'Até onde a pessoa vai, em linha reta.' }
  },
  ['latitude', 'longitude', 'radius_km'],
  'Região aproximada do trabalhador e o raio das vagas.'
);

const preferencesProps = {
  categories: { type: 'array', items: { type: 'string' }, example: ['Colheita', 'Manejo de gado'], description: 'Categorias de GET /api/categories (pode ser vazia).' } satisfies Schema,
  near: { ...nearSchema, nullable: true, description: '"Perto de mim" (null = sem região): latitude, longitude e radius_km.' } satisfies Schema,
  alerts: { type: 'boolean', example: true, description: 'Avisar na hora quando abrir vaga que combina (no máximo 3 por dia) e mandar o resumo semanal.' } satisfies Schema,
  catalog: {
    type: 'boolean', example: true,
    description: 'Aparecer no catálogo de prestadores das vagas das categorias escolhidas (começa ligado). No PUT é opcional: sem ele, fica como estava.'
  } satisfies Schema
};

export const matchingSchemas = {
  JobPreferencesNear: nearSchema,
  JobPreferences: object(preferencesProps, ['categories', 'near', 'alerts', 'catalog'], 'Preferências de vaga. O PUT troca tudo (`catalog`, se faltar, fica como estava).'),
  JobPreferencesResponse: object(
    { message: { type: 'string', example: 'Job preferences saved.' }, preferences: ref('JobPreferences') },
    ['message', 'preferences']
  ),
  RecommendedJob: object(
    {
      ...openServiceProps,
      reasons: {
        type: 'array', items: { type: 'string' }, example: ['Você escolheu Colheita', 'A 12 km de você'],
        description: 'Por que a vaga foi sugerida, em português, do motivo mais forte para o mais fraco.'
      },
      distance_km: { type: 'integer', minimum: 0, nullable: true, example: 12, description: 'Distância aproximada até a fazenda, em linha reta (só com "perto de mim").' }
    },
    [...openServiceRequired, 'reasons', 'distance_km'],
    'Vaga aberta que combina com o trabalhador.'
  ),
  CatalogWorker: object(
    {
      id: { ...id, description: 'ID do trabalhador (o `worker_id` do convite).' },
      name: { type: 'string', example: 'Maria Souza' },
      photo_url: { type: 'string', nullable: true },
      bio: { type: 'string', nullable: true },
      experience: { type: 'string', nullable: true },
      certificates: { type: 'string', nullable: true },
      reputation: ref('WorkerReputation'),
      verified: { type: 'boolean', example: true, description: 'Identidade conferida pela equipe (selo).' },
      reasons: {
        type: 'array', items: { type: 'string' }, example: ['Escolheu Colheita', 'Concluiu a trilha Manejo de gado', 'De 5 a 15 km da fazenda', 'Nota 4,8', 'Verificado'],
        description: 'Por que a pessoa aparece, do motivo mais forte para o mais fraco. A distância vem só em faixas (até 5, 5 a 15, 15 a 30, 30 a 60 e mais de 60 km).'
      }
    },
    ['id', 'name', 'photo_url', 'bio', 'experience', 'certificates', 'reputation', 'verified', 'reasons'],
    'Trabalhador no catálogo da vaga. Sem CPF, telefone, e-mail nem localização (a distância vem só em faixas, nos motivos).'
  )
} satisfies Record<MatchingSchemaName, Schema>;
