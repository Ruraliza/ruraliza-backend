import type { AccountSchemaName } from '#modules/accounts';
import { type RefTo, type Schema, input, newPassword, object, refTo, sessionToken } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI do acesso (contrato em ../auth.contract.ts). Registrados em src/docs/schemas.ts.
export type AuthSchemaName =
  | 'LoginInput' | 'PasswordResetRequestInput' | 'PasswordResetInput' | 'PasswordChangeInput'
  | 'LoginResponse' | 'PasswordResetRequestResponse';

const ref: RefTo<AccountSchemaName> = refTo;

export const authSchemas = {
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
    { token: { type: 'string', description: 'O código entregue no passo 1 (nunca volta na resposta da API).' }, password: newPassword },
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
    { message: { type: 'string', example: 'If this e-mail has an account, a reset code will be sent to it.' } },
    ['message'],
    'A mesma resposta com e sem conta para o e-mail. O código nunca vem aqui.'
  )
} satisfies Record<AuthSchemaName, Schema>;
