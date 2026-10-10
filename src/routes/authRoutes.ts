import type { AuthController } from '../controllers/AuthController';
import { TAGS, operation } from '../docs/operations';
import { type RouteDef, route } from '../http/route';

// Montadas em /api/auth. A troca de senha com a conta aberta fica no perfil
// (PATCH /api/farmers/:id/password e /api/workers/:id/password).
export function authRoutes(auth: AuthController): readonly RouteDef[] {
  return [
    route('post', '/login', auth.login, operation({
      tag: TAGS.auth,
      summary: 'Entrar com e-mail e senha',
      description:
        'Uma conta por e-mail, com a mesma senha para os perfis de produtor e trabalhador. ' +
        'Abre o último painel usado (`user.role`); ainda não há token de sessão.',
      body: 'LoginInput',
      success: { status: 200, description: 'E-mail e senha conferem.', schema: 'LoginResponse' },
      errors: {
        400: 'Campo obrigatório faltando.',
        401: 'E-mail ou senha incorretos (a mesma mensagem nos dois casos).'
      }
    })),

    route('post', '/password-reset', auth.requestPasswordReset, operation({
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
    })),

    route('post', '/password-reset/confirm', auth.resetPassword, operation({
      tag: TAGS.auth,
      summary: 'Esqueci a senha: criar a nova senha',
      description: 'Usa o token do pedido de redefinição. Depois de usado, o token não vale mais.',
      body: 'PasswordResetInput',
      success: { status: 200, description: 'Senha redefinida. Traz quem é o dono da conta.', schema: 'LoginResponse' },
      errors: { 400: 'Campo obrigatório faltando; senha fora do tamanho (8 a 128); token inválido, já usado ou expirado.' }
    }))
  ];
}
