import type { AccountSchemaName } from '#modules/accounts';
import { cpf, photoUrl, profileEditableProps, profileInputProps } from '#modules/accounts';
import { type RefTo, type Schema, id, input, isoDate, object, refTo, sessionToken } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI dos produtores (contrato em ../farmer.contract.ts). Registrados em src/docs/schemas.ts.
export type FarmerSchemaName = 'Farmer' | 'FarmerInput' | 'FarmerUpdate' | 'FarmerResponse' | 'FarmerSignupResponse';

const ref: RefTo<FarmerSchemaName | AccountSchemaName> = refTo;

// Também aparece como `nullable` dentro de AdminUser (allOf + nullable não aceita null).
export const farmerSchema: Schema = object(
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

export const farmerSchemas = {
  Farmer: farmerSchema,
  FarmerInput: input(profileInputProps, ['email', 'name', 'phone', 'cpf', 'password'], 'Cadastro de produtor.'),
  FarmerUpdate: input(
    profileEditableProps,
    [],
    'Edição parcial: envie só o que muda. Enviar `id`, `cpf` ou `password` resulta em 400 (a senha muda em PATCH /:id/password).'
  ),
  FarmerResponse: object({ message: { type: 'string', example: 'Farmer created successfully!' }, farmer: ref('Farmer') }, ['message', 'farmer']),
  FarmerSignupResponse: object(
    { message: { type: 'string', example: 'Farmer created successfully!' }, farmer: ref('Farmer'), user: ref('SessionUser'), token: sessionToken },
    ['message', 'farmer', 'user', 'token'],
    'Cadastro concluído: a conta foi criada e já está aberta (`user`, `token`).'
  )
} satisfies Record<FarmerSchemaName, Schema>;
