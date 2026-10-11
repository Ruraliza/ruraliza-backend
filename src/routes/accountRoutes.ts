import type { AccountController } from '../controllers/AccountController';
import { TAGS, operation, pathParam } from '../docs/operations';
import type { AccessPolicies } from '../http/access';
import { type RouteDef, route } from '#shared/infra/http/route';

const accountId = pathParam('id', 'ID da conta (`account_id` da sessão).');

// Montadas em /api/accounts. Uma conta tem um e-mail, uma senha e até um perfil de cada tipo.
export function accountRoutes(accounts: AccountController, access: AccessPolicies): readonly RouteDef[] {
  return [
    route('get', '/:id', accounts.getAccount, operation({
      tag: TAGS.auth,
      summary: 'Sessão da conta',
      description: 'Os perfis da conta e o painel aberto, no mesmo formato do login.',
      params: [accountId],
      success: { status: 200, description: 'Sessão atual.', schema: 'SessionUser' },
      errors: { 404: 'Conta não encontrada.' }
    }), access.ownAccount()),

    route('post', '/:id/profiles', accounts.createAccountProfile, operation({
      tag: TAGS.auth,
      summary: 'Criar o outro perfil na conta',
      description:
        'Produtor que também quer ser trabalhador (ou o contrário). O e-mail e a senha são os da conta. ' +
        'O novo perfil passa a ser o painel aberto.',
      params: [accountId],
      body: 'ProfileCreateInput',
      success: { status: 201, description: 'Perfil criado; sessão já com o painel novo.', schema: 'SessionResponse' },
      errors: {
        400: 'Campo obrigatório faltando; `role` inválido; CPF inválido; enviou `email` ou `password`; texto longo demais.',
        404: 'Conta não encontrada.',
        409: 'A conta já tem esse perfil; CPF de outra conta.'
      }
    }), access.ownAccount()),

    route('patch', '/:id/active-role', accounts.setActiveRole, operation({
      tag: TAGS.auth,
      summary: 'Trocar o painel aberto',
      description: 'Também define o painel que abre no próximo login.',
      params: [accountId],
      body: 'ActiveRoleInput',
      success: { status: 200, description: 'Painel trocado.', schema: 'SessionResponse' },
      errors: { 400: '`role` faltando ou inválido.', 404: 'Conta não encontrada, ou ela ainda não tem esse perfil.' }
    }), access.ownAccount()),

    route('post', '/:id/push-subscriptions', accounts.subscribePush, operation({
      tag: TAGS.auth,
      summary: 'Ativar notificações push neste navegador',
      description:
        'Guarda a inscrição de `PushManager.subscribe()` (com a chave de GET /api/config/push). ' +
        'Vale para os dois perfis da conta. Pode ser reenviada: o `endpoint` identifica o navegador.',
      params: [accountId],
      body: 'PushSubscriptionInput',
      success: { status: 201, description: 'Inscrição guardada.', schema: 'MessageResponse' },
      errors: { 400: '`endpoint` não é uma URL https; `keys.p256dh` ou `keys.auth` faltando.', 404: 'Conta não encontrada.' }
    }), access.ownAccount()),

    route('delete', '/:id/push-subscriptions', accounts.unsubscribePush, operation({
      tag: TAGS.auth,
      summary: 'Desativar notificações push neste navegador',
      description: 'Remove a inscrição com esse `endpoint` (se não existir, nada muda).',
      params: [accountId],
      body: 'PushUnsubscribeInput',
      success: { status: 200, description: 'Inscrição removida.', schema: 'MessageResponse' },
      errors: { 400: '`endpoint` não é uma URL https.', 404: 'Conta não encontrada.' }
    }), access.ownAccount())
  ];
}
