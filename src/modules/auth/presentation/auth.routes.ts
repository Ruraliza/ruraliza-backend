import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { PUBLIC_ROUTE } from '#shared/infra/http/access';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { AccessPolicies } from './access';
import type { AuthController } from './auth.controller';
import type { AuthSchemaName } from './auth.schemas';

const authOperation = operation<AuthSchemaName>;

export interface AuthRoutes {
  // Em /api/auth: login do app e "esqueci a senha". O login da equipe (/api/auth/system/*)
  // vem de src/modules/system-users.
  auth: readonly RouteDef[];
  // Em /api/farmers e /api/workers: troca de senha com a conta aberta.
  farmerPassword: readonly RouteDef[];
  workerPassword: readonly RouteDef[];
}

export function authRoutes(auth: AuthController, access: AccessPolicies): AuthRoutes {
  const farmerId = pathParam('id', 'ID do produtor.');
  const workerId = pathParam('id', 'ID do trabalhador.');

  return {
    auth: [
      route('post', '/login', auth.login, authOperation({
        tag: TAGS.auth,
        summary: 'Entrar com e-mail e senha',
        description:
          'Uma conta por e-mail, com a mesma senha para os perfis de produtor e trabalhador. ' +
          'Abre o último painel usado (`user.role`). O `token` vale 12 horas e vai em `Authorization: Bearer <token>` ' +
          'nas rotas que exigem a conta aberta (o mesmo token serve para os dois perfis).',
        body: 'LoginInput',
        success: { status: 200, description: 'E-mail e senha conferem.', schema: 'LoginResponse' },
        errors: {
          400: 'Campo obrigatório faltando.',
          401: 'E-mail ou senha incorretos (a mesma mensagem nos dois casos).'
        }
      }), PUBLIC_ROUTE),

      route('post', '/password-reset', auth.requestPasswordReset, authOperation({
        tag: TAGS.auth,
        summary: 'Esqueci a senha: pedir redefinição',
        description:
          '**Simulação.** O certo é enviar um código por e-mail; como o envio ainda não existe, o token volta na resposta ' +
          '(`reset_token`) para o app seguir direto para a criação da nova senha. Vale por 30 minutos e uma vez só; ' +
          'um pedido novo invalida o anterior.',
        body: 'PasswordResetRequestInput',
        success: { status: 200, description: 'Redefinição criada.', schema: 'PasswordResetRequestResponse' },
        errors: {
          400: 'Campo obrigatório faltando; e-mail inválido.',
          404: 'Não há conta com este e-mail.'
        }
      }), PUBLIC_ROUTE),

      route('post', '/password-reset/confirm', auth.resetPassword, authOperation({
        tag: TAGS.auth,
        summary: 'Esqueci a senha: criar a nova senha',
        description: 'Usa o token do pedido de redefinição. Depois de usado, o token não vale mais.',
        body: 'PasswordResetInput',
        success: { status: 200, description: 'Senha redefinida. Traz quem é o dono da conta.', schema: 'LoginResponse' },
        errors: { 400: 'Campo obrigatório faltando; senha fora do tamanho (8 a 128); token inválido, já usado ou expirado.' }
      }), PUBLIC_ROUTE)
    ],
    farmerPassword: [
      route('patch', '/:id/password', auth.changeFarmerPassword, authOperation({
        tag: TAGS.farmers,
        summary: 'Trocar a senha (com a conta aberta)',
        description: 'Confirma a senha atual; não precisa de código por e-mail. Cancela uma redefinição de senha pendente.',
        params: [farmerId],
        body: 'PasswordChangeInput',
        success: { status: 200, description: 'Senha trocada.', schema: 'MessageResponse' },
        errors: {
          400: 'Campo obrigatório faltando; nova senha fora do tamanho (8 a 128) ou igual à atual.',
          401: 'A senha atual está incorreta.',
          404: 'Produtor não encontrado.'
        }
      }), access.ownFarmer())
    ],
    workerPassword: [
      route('patch', '/:id/password', auth.changeWorkerPassword, authOperation({
        tag: TAGS.workers,
        summary: 'Trocar a senha (com a conta aberta)',
        description: 'Confirma a senha atual; não precisa de código por e-mail. Cancela uma redefinição de senha pendente.',
        params: [workerId],
        body: 'PasswordChangeInput',
        success: { status: 200, description: 'Senha trocada.', schema: 'MessageResponse' },
        errors: {
          400: 'Campo obrigatório faltando; nova senha fora do tamanho (8 a 128) ou igual à atual.',
          401: 'A senha atual está incorreta.',
          404: 'Trabalhador não encontrado.'
        }
      }), access.ownWorker())
    ]
  };
}
