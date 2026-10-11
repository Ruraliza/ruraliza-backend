import { type AccountSchemaName, accountSchemas } from '#modules/accounts';
import { type AuthSchemaName, authSchemas } from '#modules/auth';
import { type FarmerSchemaName, farmerSchema, farmerSchemas } from '#modules/farmers';
import { type FarmSchemaName, farmSchemas } from '#modules/farms';
import { type HiringSchemaName, hiringSchemas } from '#modules/hiring';
import { type PushSchemaName, pushSchemas } from '#modules/notifications';
import { type ServiceSchemaName, serviceSchemas } from '#modules/services';
import { type SystemUserSchemaName, systemUserSchemas } from '#modules/system-users';
import { type WorkerSchemaName, workerSchema, workerSchemas } from '#modules/workers';
import { type CoreSchemaName, coreSchemas } from '#shared/infra/docs/core.schemas';
import { type RefTo, type Schema, id, object, refTo } from '#shared/infra/docs/schema-kit';

// Registro dos schemas OpenAPI do contrato (src/contracts): os genéricos (#shared/infra/docs),
// os dos módulos já migrados e, aqui mesmo, os das partes ainda não migradas para src/modules.

// Nomes dos schemas. `schemas` abaixo precisa ter exatamente estes (o `satisfies` acusa falta ou sobra),
// e `ref()` só aceita estes, então um $ref quebrado não compila.
export type SchemaName =
  | CoreSchemaName
  | ServiceSchemaName
  | HiringSchemaName
  | 'HealthResponse' | 'MapsConfig'
  | PushSchemaName
  | FarmSchemaName
  | FarmerSchemaName
  | WorkerSchemaName
  | AccountSchemaName
  | AuthSchemaName
  | SystemUserSchemaName
  | 'AdminUser';

const ref: RefTo<SchemaName> = refTo;

// --- Propriedades reaproveitadas ---



export const schemas = {
  // --- Status ---
  // --- Respostas genéricas ---
  ...coreSchemas,
  HealthResponse: object({ message: { type: 'string' } }, ['message']),
  MapsConfig: object(
    {
      api_key: { type: 'string', example: 'AIza…', description: 'Chave do Google Maps Platform (restrita por referrer no Google Cloud).' },
      map_id: { type: 'string', example: 'DEMO_MAP_ID', description: 'Map ID para o alfinete arrastável (Advanced Marker).' }
    },
    ['api_key', 'map_id'],
    'Configuração do Google Maps para o frontend.'
  ),
  // --- Entidades ---
  ...farmerSchemas,
  ...farmSchemas,
  ...workerSchemas,
  ...serviceSchemas,
  ...hiringSchemas,
  ...pushSchemas,
  // --- Entradas ---
  // --- Acesso ---
  ...accountSchemas,
  ...authSchemas,
  // --- Respostas das escritas ---
  // --- Usuários de sistema e administração ---
  ...systemUserSchemas,
  AdminUser: object(
    {
      account_id: id,
      email: { type: 'string', format: 'email', example: 'ambos@exemplo.com' },
      farmer: { ...farmerSchema, nullable: true, description: 'Perfil de produtor (null = a conta não tem).' },
      worker: { ...workerSchema, nullable: true, description: 'Perfil de trabalhador (null = a conta não tem).' }
    },
    ['account_id', 'email', 'farmer', 'worker'],
    'Conta do app com os perfis. CPF mascarado na lista e completo no detalhe.'
  )
} satisfies Record<SchemaName, Schema>;

export { ref };
