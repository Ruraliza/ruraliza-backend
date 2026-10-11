import { type FarmSchemaName, farmSchemas } from '#modules/farms';
import { type HiringSchemaName, hiringSchemas } from '#modules/hiring';
import { type ServiceSchemaName, serviceSchemas } from '#modules/services';
import { type CoreSchemaName, coreSchemas } from '#shared/infra/docs/core.schemas';
import { type Properties, type RefTo, type Schema, id, input, isoDate, nullableId, object, refTo } from '#shared/infra/docs/schema-kit';

// Registro dos schemas OpenAPI do contrato (src/contracts): os genéricos (#shared/infra/docs),
// os dos módulos já migrados e, aqui mesmo, os das partes ainda não migradas para src/modules.

// Nomes dos schemas. `schemas` abaixo precisa ter exatamente estes (o `satisfies` acusa falta ou sobra),
// e `ref()` só aceita estes, então um $ref quebrado não compila.
export type SchemaName =
  | CoreSchemaName
  | ServiceSchemaName
  | HiringSchemaName
  | 'HealthResponse' | 'MapsConfig' | 'PushConfig'
  | FarmSchemaName
  | 'Farmer' | 'Worker'
  | 'FarmerInput' | 'FarmerUpdate' | 'WorkerInput' | 'WorkerUpdate'
  | 'UserRole' | 'SessionUser' | 'LoginInput' | 'PasswordResetRequestInput' | 'PasswordResetInput' | 'PasswordChangeInput'
  | 'ProfileCreateInput' | 'ActiveRoleInput' | 'PushSubscriptionInput' | 'PushUnsubscribeInput'
  | 'LoginResponse' | 'PasswordResetRequestResponse' | 'SessionResponse'
  | 'FarmerResponse' | 'WorkerResponse' | 'FarmerSignupResponse' | 'WorkerSignupResponse'
  | 'SystemRole' | 'SystemUser' | 'SystemUserInput' | 'SystemUserUpdate' | 'AdminSystemUserUpdate' | 'SystemLoginResponse' | 'SystemUserResponse' | 'AdminUser';

const photoUrl: Schema = {
  type: 'string',
  nullable: true,
  example: '/api/images/3f2c1b9e-8d7a-4c1e-9b1a-2f6e5d4c3b2a.webp',
  description: 'Foto de perfil (WebP quadrado, no máximo 1000×1000px). null quando não há foto. Relativa à API.'
};
const resumeUrl: Schema = {
  type: 'string',
  nullable: true,
  example: '/api/documents/3f2c1b9e-8d7a-4c1e-9b1a-2f6e5d4c3b2a.pdf',
  description: 'Currículo em PDF. null quando não há currículo. Relativa à API.'
};
const sessionToken: Schema = {
  type: 'string',
  example: 'eyJraW5kIjoiYWNjb3VudCIsImlkIjoxLCJleHAiOjE3OTk5OTk5OTk5OTl9.p0dTqW…',
  description: 'Token de sessão (12 horas). Envie em `Authorization: Bearer <token>`.'
};
const ref: RefTo<SchemaName> = refTo;

// --- Propriedades reaproveitadas ---



const cpf: Schema = {
  type: 'string',
  example: '52998224725',
  description: '11 dígitos, só números. Completo no GET do próprio perfil; mascarado (***.982.247-**) em listas e respostas embutidas.'
};

// Campos editáveis dos dois perfis (o cpf só entra no cadastro).
const profileEditableProps: Properties = {
  email: { type: 'string', format: 'email', example: 'ana@exemplo.com', description: 'Guardado em minúsculas. É o e-mail da conta: único entre as contas e o mesmo nos dois perfis dela.' },
  name: { type: 'string', example: 'Ana Produtora' },
  phone: { type: 'string', example: '24999990000', description: 'Com DDD, só números.' }
};
const newPassword: Schema = {
  type: 'string',
  format: 'password',
  minLength: 8,
  maxLength: 128,
  example: 'minhasenha123',
  description: 'De 8 a 128 caracteres (espaços contam). Guardada só como hash; nunca volta nas respostas.'
};
const profileInputProps: Properties = {
  ...profileEditableProps,
  cpf: { ...cpf, description: '11 dígitos com dígitos verificadores válidos. Pertence a uma conta só.' },
  password: newPassword
};

const optionalText: Schema = { type: 'string', nullable: true };
const workerTextProps: Properties = {
  bio: { ...optionalText, maxLength: 500, description: 'Breve apresentação. Vazio vira null.' },
  certificates: { ...optionalText, maxLength: 1000, example: 'NR-31, curso de tratorista', description: 'Vazio vira null.' },
  courses: { ...optionalText, maxLength: 1000, example: 'Operação de trator (SENAR)', description: 'Vazio vira null.' },
  experience: { ...optionalText, maxLength: 1000, example: '5 anos em colheita de café', description: 'Vazio vira null.' }
};

// Perfis: também aparecem como `nullable` dentro de AdminUser (allOf + nullable não aceita null).
const farmerSchema: Schema = object(
  {
    id,
    email: { type: 'string', format: 'email', example: 'produtor@exemplo.com' },
    name: { type: 'string', example: 'João Produtor' },
    farms: { type: 'array', items: { type: 'integer' }, example: [1, 2], description: 'IDs das fazendas ativas.' },
    phone: { type: 'string', example: '24999999999' },
    cpf,
    photo_url: photoUrl,
    insertion_date: isoDate
  },
  ['id', 'email', 'name', 'farms', 'phone', 'cpf', 'photo_url', 'insertion_date']
);

const workerSchema: Schema = object(
  {
    id,
    email: { type: 'string', format: 'email', example: 'trabalhador@exemplo.com' },
    name: { type: 'string', example: 'Maria Trabalhadora' },
    bio: { ...optionalText, maxLength: 500, example: 'Trabalho com colheita de café há 5 anos. Disponível nos fins de semana.' },
    certificates: { ...optionalText, example: 'Certificado de Tratorista' },
    courses: { ...optionalText, example: 'NR-31 (SENAR, 2024)' },
    experience: { ...optionalText, example: '5 anos' },
    phone: { type: 'string', example: '24988888888' },
    cpf,
    photo_url: photoUrl,
    resume_url: resumeUrl,
    insertion_date: isoDate
  },
  ['id', 'email', 'name', 'bio', 'certificates', 'courses', 'experience', 'phone', 'cpf', 'photo_url', 'resume_url', 'insertion_date']
);

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
  PushConfig: object(
    { public_key: { type: 'string', example: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' } },
    ['public_key'],
    'Chave pública VAPID (base64url) para o PushManager.subscribe().'
  ),

  // --- Entidades ---
  Farmer: farmerSchema,
  Worker: workerSchema,
  ...farmSchemas,
  ...serviceSchemas,
  ...hiringSchemas,
  // --- Entradas ---
  FarmerInput: input(profileInputProps, ['email', 'name', 'phone', 'cpf', 'password'], 'Cadastro de produtor.'),
  FarmerUpdate: input(
    profileEditableProps,
    [],
    'Edição parcial: envie só o que muda. Enviar `id`, `cpf` ou `password` resulta em 400 (a senha muda em PATCH /:id/password).'
  ),
  WorkerInput: input(
    {
      ...profileInputProps,
      ...workerTextProps
    },
    ['email', 'name', 'phone', 'cpf', 'password'],
    'Cadastro de trabalhador.'
  ),
  WorkerUpdate: input(
    {
      ...profileEditableProps,
      bio: { ...optionalText, maxLength: 500, description: 'null limpa o campo.' },
      certificates: { ...optionalText, maxLength: 1000, description: 'null limpa o campo.' },
      courses: { ...optionalText, maxLength: 1000, description: 'null limpa o campo.' },
      experience: { ...optionalText, maxLength: 1000, description: 'null limpa o campo.' }
    },
    [],
    'Edição parcial: envie só o que muda. Enviar `id`, `cpf` ou `password` resulta em 400 (a senha muda em PATCH /:id/password).'
  ),
  // --- Acesso ---
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
  PushSubscriptionInput: input(
    {
      endpoint: { type: 'string', format: 'uri', example: 'https://fcm.googleapis.com/fcm/send/abc123' },
      keys: object(
        { p256dh: { type: 'string', example: 'BNcRdreALRFX…' }, auth: { type: 'string', example: 'tBHItJI5svbpez7KI4CCXg' } },
        ['p256dh', 'auth']
      )
    },
    ['endpoint', 'keys'],
    'O `PushSubscription.toJSON()` do navegador (`expirationTime` é ignorado).'
  ),
  PushUnsubscribeInput: input(
    { endpoint: { type: 'string', format: 'uri', example: 'https://fcm.googleapis.com/fcm/send/abc123' } },
    ['endpoint'],
    'Inscrição (navegador) a remover.'
  ),
  ActiveRoleInput: input({ role: ref('UserRole') }, ['role'], 'Painel a abrir. A conta precisa ter esse perfil.'),
  LoginResponse: object(
    { message: { type: 'string', example: 'Logged in successfully!' }, user: ref('SessionUser'), token: sessionToken },
    ['message', 'user', 'token']
  ),
  SessionResponse: object({ message: { type: 'string', example: 'Profile created successfully!' }, user: ref('SessionUser') }, ['message', 'user']),
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
  FarmerResponse: object({ message: { type: 'string', example: 'Farmer created successfully!' }, farmer: ref('Farmer') }, ['message', 'farmer']),
  WorkerResponse: object({ message: { type: 'string', example: 'Worker created successfully!' }, worker: ref('Worker') }, ['message', 'worker']),
  FarmerSignupResponse: object(
    { message: { type: 'string', example: 'Farmer created successfully!' }, farmer: ref('Farmer'), user: ref('SessionUser'), token: sessionToken },
    ['message', 'farmer', 'user', 'token'],
    'Cadastro concluído: a conta foi criada e já está aberta (`user`, `token`).'
  ),
  WorkerSignupResponse: object(
    { message: { type: 'string', example: 'Worker created successfully!' }, worker: ref('Worker'), user: ref('SessionUser'), token: sessionToken },
    ['message', 'worker', 'user', 'token'],
    'Cadastro concluído: a conta foi criada e já está aberta (`user`, `token`).'
  ),
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
