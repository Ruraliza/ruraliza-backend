import { type Schema, object } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI do estado do servidor e da configuração (contrato em ../platform.contract.ts).
export type PlatformSchemaName = 'HealthResponse' | 'MapsConfig';

export const platformSchemas = {
  HealthResponse: object({ message: { type: 'string' } }, ['message']),
  MapsConfig: object(
    {
      api_key: { type: 'string', example: 'AIza…', description: 'Chave do Google Maps Platform (restrita por referrer no Google Cloud).' },
      map_id: { type: 'string', example: 'DEMO_MAP_ID', description: 'Map ID para o alfinete arrastável (Advanced Marker).' }
    },
    ['api_key', 'map_id'],
    'Configuração do Google Maps para o frontend.'
  )
} satisfies Record<PlatformSchemaName, Schema>;
