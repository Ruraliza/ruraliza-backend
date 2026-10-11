import type { AuthController } from '../controllers/AuthController';
import { TAGS, operation } from '../docs/operations';
import { type AccessPolicies, PUBLIC_ROUTE } from '../http/access';
import { type RouteDef, route } from '../http/route';

// Montadas em /api/auth. A troca de senha com a conta aberta fica no perfil
// (PATCH /api/farmers/:id/password e /api/workers/:id/password).
// O login da equipe (usuários de sistema) é separado: /api/auth/system/*.
export function authRoutes(auth: AuthController, access: AccessPolicies): readonly RouteDef[] {
  return [
    route('post', '/login', auth.login, operation({
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
    }), PUBLIC_ROUTE),

    route('post', '/password-reset/confirm', auth.resetPassword, operation({
      tag: TAGS.auth,
      summary: 'Esqueci a senha: criar a nova senha',
      description: 'Usa o token do pedido de redefinição. Depois de usado, o token não vale mais.',
      body: 'PasswordResetInput',
      success: { status: 200, description: 'Senha redefinida. Traz quem é o dono da conta.', schema: 'LoginResponse' },
      errors: { 400: 'Campo obrigatório faltando; senha fora do tamanho (8 a 128); token inválido, já usado ou expirado.' }
    }), PUBLIC_ROUTE),

    route('post', '/system/login', auth.systemLogin, operation({
      tag: TAGS.auth,
      summary: 'Entrar como usuário de sistema',
      description:
        'Login da equipe do Ruraliza (administradores e tutores), separado das contas do app. Não há cadastro público: ' +
        'quem cria usuários de sistema é um administrador. O `token` vale 12 horas.',
      body: 'LoginInput',
      success: { status: 200, description: 'E-mail e senha conferem.', schema: 'SystemLoginResponse' },
      errors: {
        400: 'Campo obrigatório faltando.',
        401: 'E-mail ou senha incorretos (a mesma mensagem nos dois casos).'
      }
    }), PUBLIC_ROUTE),

    route('get', '/system/me', auth.getSystemSession, operation({
      tag: TAGS.auth,
      summary: 'Sessão do usuário de sistema',
      description: 'Quem é o dono do token, com o cargo atual.',
      success: { status: 200, description: 'Usuário de sistema.', schema: 'SystemUser' }
    }), access.anySystemUser)
  ];
}
