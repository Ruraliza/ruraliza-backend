import { type AccountSchemaName, accountSchemas } from '#modules/accounts';
import { type FarmerSchemaName, farmerSchema, farmerSchemas } from '#modules/farmers';
import { type FarmSchemaName, farmSchemas } from '#modules/farms';
import { type HiringSchemaName, hiringSchemas } from '#modules/hiring';
import { type PushSchemaName, pushSchemas } from '#modules/notifications';
import { type ServiceSchemaName, serviceSchemas } from '#modules/services';
import { type WorkerSchemaName, workerSchema, workerSchemas } from '#modules/workers';
import { type CoreSchemaName, coreSchemas } from '#shared/infra/docs/core.schemas';
import { type RefTo, type Schema, id, input, isoDate, newPassword, object, refTo, sessionToken } from '#shared/infra/docs/schema-kit';

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
  | 'LoginInput' | 'PasswordResetRequestInput' | 'PasswordResetInput' | 'PasswordChangeInput'
  | 'LoginResponse' | 'PasswordResetRequestResponse'
  | 'SystemRole' | 'SystemUser' | 'SystemUserInput' | 'SystemUserUpdate' | 'AdminSystemUserUpdate' | 'SystemLoginResponse' | 'SystemUserResponse' | 'AdminUser';

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
  LoginInput: input(
    {
      email: { type: 'string', format: 'email', example: 'produtor@exemplo.com' },
      password: { type: 'string', format: 'password', example: 'ruraliza123' }
    },
    ['email', 'password'],
    'Login. As contas de teste do seed usam a senha `ruraliza123`.'
  ),
  PasswordResetRequestInput: input(
    { email: { type: 'string', format: 'email', example: 'produtor@exemplo.com' } },
    ['email'],
    'Passo 1 do "esqueci a senha".'
  ),
  PasswordResetInput: input(
    { token: { type: 'string', description: 'O `reset_token` do passo 1.' }, password: newPassword },
    ['token', 'password'],
    'Passo 2 do "esqueci a senha": a nova senha.'
  ),
  PasswordChangeInput: input(
    { current_password: { type: 'string', format: 'password', example: 'ruraliza123' }, new_password: newPassword },
    ['current_password', 'new_password'],
    'Troca de senha com a conta aberta. A nova precisa ser diferente da atual.'
  ),
  LoginResponse: object(
    { message: { type: 'string', example: 'Logged in successfully!' }, user: ref('SessionUser'), token: sessionToken },
    ['message', 'user', 'token']
  ),
  PasswordResetRequestResponse: object(
    {
      message: { type: 'string', example: 'Password reset requested (simulation: the e-mail was not sent).' },
      reset_token: {
        type: 'string',
        example: 'q8Jm1t0bX0b7cL0yFq3x2v9h4T1pZ6wE5rK8nU2sA3c',
        description: 'Simulação: iria por e-mail. Vale 30 minutos e uma vez só; use em POST /api/auth/password-reset/confirm.'
      }
    },
    ['message', 'reset_token']
  ),

  // --- Respostas das escritas ---
  // --- Usuários de sistema e administração ---
  SystemRole: {
    type: 'string',
    enum: ['admin', 'tutor'],
    example: 'admin',
    description: 'Cargo. `admin`: gerencia as contas do app e a equipe. `tutor`: vai gerenciar as trilhas de estudo.'
  },
  SystemUser: object(
    {
      id,
      email: { type: 'string', format: 'email', example: 'admin@exemplo.com' },
      name: { type: 'string', example: 'Ana Administradora' },
      role: ref('SystemRole'),
      insertion_date: isoDate
    },
    ['id', 'email', 'name', 'role', 'insertion_date'],
    'Usuário da equipe do Ruraliza (não é uma conta do app).'
  ),
  SystemUserInput: input(
    {
      email: { type: 'string', format: 'email', example: 'tutor@exemplo.com', description: 'Guardado em minúsculas. Único entre os usuários de sistema.' },
      name: { type: 'string', maxLength: 120, example: 'Tiago Tutor' },
      role: ref('SystemRole'),
      password: newPassword
    },
    ['email', 'name', 'role', 'password'],
    'Novo usuário de sistema.'
  ),
  SystemUserUpdate: input(
    {
      name: { type: 'string', maxLength: 120, example: 'Ana Souza' },
      email: { type: 'string', format: 'email', example: 'ana@exemplo.com', description: 'Guardado em minúsculas. Único entre os usuários de sistema.' }
    },
    [],
    'Edição parcial do próprio perfil: envie só o que muda. Enviar `id`, `role` ou `password` resulta em 400.'
  ),
  AdminSystemUserUpdate: input(
    {
      name: { type: 'string', maxLength: 120, example: 'Tiago Tutor' },
      email: { type: 'string', format: 'email', example: 'tutor@exemplo.com', description: 'Guardado em minúsculas. Único entre os usuários de sistema.' },
      role: ref('SystemRole')
    },
    [],
    'Edição parcial pelo administrador. Enviar `id` ou `password` resulta em 400; mudar o próprio cargo, em 409.'
  ),
  SystemLoginResponse: object(
    { message: { type: 'string', example: 'Logged in successfully!' }, user: ref('SystemUser'), token: sessionToken },
    ['message', 'user', 'token']
  ),
  SystemUserResponse: object(
    { message: { type: 'string', example: 'System user created successfully!' }, system_user: ref('SystemUser') },
    ['message', 'system_user']
  ),
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
