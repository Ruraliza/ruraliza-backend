import { type AccountSchemaName, cpf, optionalTextSchema, photoUrl, profileEditableProps, profileInputProps, workerTextProps } from '#modules/accounts';
import { type RefTo, type Schema, id, input, isoDate, object, refTo, sessionToken } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI dos trabalhadores (contrato em ../worker.contract.ts). Registrados em src/docs/schemas.ts.
export type WorkerSchemaName = 'Worker' | 'WorkerInput' | 'WorkerUpdate' | 'WorkerResponse' | 'WorkerSignupResponse';

const ref: RefTo<WorkerSchemaName | AccountSchemaName> = refTo;

const resumeUrl: Schema = {
  type: 'string',
  nullable: true,
  example: '/api/documents/3f2c1b9e-8d7a-4c1e-9b1a-2f6e5d4c3b2a.pdf',
  description: 'Currículo em PDF. null quando não há currículo. Relativa à API.'
};

// Também aparece como `nullable` dentro de AdminUser (allOf + nullable não aceita null).
export const workerSchema: Schema = object(
  {
    id,
    email: { type: 'string', format: 'email', example: 'trabalhador@exemplo.com' },
    name: { type: 'string', example: 'Maria Trabalhadora' },
    bio: { ...optionalTextSchema, maxLength: 500, example: 'Trabalho com colheita de café há 5 anos. Disponível nos fins de semana.' },
    certificates: { ...optionalTextSchema, example: 'Certificado de Tratorista' },
    courses: { ...optionalTextSchema, example: 'NR-31 (SENAR, 2024)' },
    experience: { ...optionalTextSchema, example: '5 anos' },
    phone: { type: 'string', example: '24988888888' },
    cpf,
    photo_url: photoUrl,
    resume_url: resumeUrl,
    insertion_date: isoDate
  },
  ['id', 'email', 'name', 'bio', 'certificates', 'courses', 'experience', 'phone', 'cpf', 'photo_url', 'resume_url', 'insertion_date']
);

export const workerSchemas = {
  Worker: workerSchema,
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
      bio: { ...optionalTextSchema, maxLength: 500, description: 'null limpa o campo.' },
      certificates: { ...optionalTextSchema, maxLength: 1000, description: 'null limpa o campo.' },
      courses: { ...optionalTextSchema, maxLength: 1000, description: 'null limpa o campo.' },
      experience: { ...optionalTextSchema, maxLength: 1000, description: 'null limpa o campo.' }
    },
    [],
    'Edição parcial: envie só o que muda. Enviar `id`, `cpf` ou `password` resulta em 400 (a senha muda em PATCH /:id/password).'
  ),
  WorkerResponse: object({ message: { type: 'string', example: 'Worker created successfully!' }, worker: ref('Worker') }, ['message', 'worker']),
  WorkerSignupResponse: object(
    { message: { type: 'string', example: 'Worker created successfully!' }, worker: ref('Worker'), user: ref('SessionUser'), token: sessionToken },
    ['message', 'worker', 'user', 'token'],
    'Cadastro concluído: a conta foi criada e já está aberta (`user`, `token`).'
  )
} satisfies Record<WorkerSchemaName, Schema>;
