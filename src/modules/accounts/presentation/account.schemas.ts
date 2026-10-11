import { type RefTo, type Schema, id, input, nullableId, object, refTo } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI da conta e da sessão (contrato em ../accounts.contract.ts). Registrados em src/docs/schemas.ts.
// ProfileCreateInput ainda fica no registro: é montado com as peças dos schemas de perfil.
export type AccountSchemaName = 'UserRole' | 'SessionUser' | 'ActiveRoleInput' | 'SessionResponse';

const ref: RefTo<AccountSchemaName> = refTo;

export const accountSchemas = {
  UserRole: { type: 'string', enum: ['farmer', 'worker'], example: 'farmer', description: 'Tipo de perfil. Uma conta pode ter um de cada.' },
  SessionUser: object(
    {
      account_id: id,
      role: ref('UserRole'),
      id,
      profiles: object({ farmer: nullableId, worker: nullableId }, ['farmer', 'worker'], 'Perfis da conta (null = ainda não tem).')
    },
    ['account_id', 'role', 'id', 'profiles'],
    'Quem entrou. `role`/`id` são o perfil ativo (o painel aberto): o id é do produtor ou do trabalhador, conforme `role`.'
  ),
  ActiveRoleInput: input({ role: ref('UserRole') }, ['role'], 'Painel a abrir. A conta precisa ter esse perfil.'),
  SessionResponse: object({ message: { type: 'string', example: 'Profile created successfully!' }, user: ref('SessionUser') }, ['message', 'user'])
} satisfies Record<AccountSchemaName, Schema>;
