import { type RefTo, type Schema, id, input, nullableId, object, refTo } from '#shared/infra/docs/schema-kit';
import { cpf, profileEditableProps, workerTextProps } from './profile.schema-parts';

// Schemas OpenAPI da conta e da sessão (contrato em ../accounts.contract.ts). Registrados em src/docs/schemas.ts.
export type AccountSchemaName =
  | 'UserRole'
  | 'SessionUser'
  | 'ProfileCreateInput'
  | 'ActiveRoleInput'
  | 'SessionResponse'
  | 'AccountPreferences'
  | 'AccountPreferencesInput'
  | 'PreferencesResponse';

const ref: RefTo<AccountSchemaName> = refTo;

const preferenceProps = {
  theme: { type: 'string', enum: ['light', 'dark', 'system'], example: 'dark', description: "'system' segue o tema do aparelho." },
  text_size: { type: 'string', enum: ['normal', 'large'], example: 'large', description: "'large' aumenta todos os textos em 25%." },
  high_contrast: { type: 'boolean', example: true, description: 'Cores mais fortes e bordas mais escuras.' },
  whatsapp_alerts: { type: 'boolean', example: false, description: 'Avisos importantes também no WhatsApp do perfil (celular com DDD). Desligado por padrão.' }
} satisfies Record<string, Schema>;

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
  SessionResponse: object({ message: { type: 'string', example: 'Profile created successfully!' }, user: ref('SessionUser') }, ['message', 'user']),
  AccountPreferences: object(
    preferenceProps,
    ['theme', 'text_size', 'high_contrast', 'whatsapp_alerts'],
    'Preferências da conta, nos dois painéis e em qualquer aparelho. Padrão: tema claro, texto normal, sem alto contraste e sem WhatsApp.'
  ),
  AccountPreferencesInput: input(preferenceProps, [], 'Só o que mudou; ao menos um campo. Campos desconhecidos são ignorados.'),
  PreferencesResponse: object(
    { message: { type: 'string', example: 'Preferences saved successfully!' }, preferences: ref('AccountPreferences') },
    ['message', 'preferences']
  )
} satisfies Record<AccountSchemaName, Schema>;
