import { type RefTo, type Schema, id, input, nullableId, object, refTo } from '#shared/infra/docs/schema-kit';
import { cpf, profileEditableProps, workerTextProps } from './profile.schema-parts';

// Schemas OpenAPI da conta e da sessão (contrato em ../accounts.contract.ts). Registrados em src/docs/schemas.ts.
export type AccountSchemaName = 'UserRole' | 'SessionUser' | 'ProfileCreateInput' | 'ActiveRoleInput' | 'SessionResponse';

const ref: RefTo<AccountSchemaName> = refTo;

export const accountSchemas = {
  ProfileCreateInput: input(
    {
      role: ref('UserRole'),
      name: profileEditableProps['name'] as Schema,
      phone: profileEditableProps['phone'] as Schema,
      cpf: { ...cpf, description: '11 dígitos com dígitos verificadores válidos. Não pode ser de outra conta.' },
      ...workerTextProps
    },
    ['role', 'name', 'phone', 'cpf'],
    'Segundo perfil na mesma conta: o e-mail e a senha são os da conta. `bio`, `certificates`, `courses` e `experience` só valem para trabalhador.'
  ),
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
