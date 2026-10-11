import { type RefTo, type Schema, id, input, isoDate, newPassword, object, refTo, sessionToken } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI da equipe (contrato em ../system-user.contract.ts). Registrados em src/docs/schemas.ts.
export type SystemUserSchemaName =
  | 'SystemRole' | 'SystemUser' | 'SystemUserInput' | 'SystemUserUpdate' | 'AdminSystemUserUpdate'
  | 'SystemLoginResponse' | 'SystemUserResponse';

const ref: RefTo<SystemUserSchemaName> = refTo;

export const systemUserSchemas = {
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
  )
} satisfies Record<SystemUserSchemaName, Schema>;
