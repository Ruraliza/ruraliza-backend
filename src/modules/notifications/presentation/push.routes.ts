import type { AccessPolicies } from '#modules/auth';
import { TAGS, operation, pathParam } from '#shared/infra/docs/operations';
import { PUBLIC_ROUTE } from '#shared/infra/http/access';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { PushController } from './push.controller';
import type { PushSchemaName } from './push.schemas';

const accountId = pathParam('id', 'ID da conta (`account_id` da sessão).');
const pushOperation = operation<PushSchemaName>;

export interface PushRoutes {
  // Em /api/accounts: inscrições de push da conta.
  account: readonly RouteDef[];
  // Em /api: a chave pública VAPID.
  config: readonly RouteDef[];
}

export function pushRoutes(push: PushController, access: AccessPolicies): PushRoutes {
  return {
    account: [
      route('post', '/:id/push-subscriptions', push.subscribePush, pushOperation({
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

      route('delete', '/:id/push-subscriptions', push.unsubscribePush, pushOperation({
        tag: TAGS.auth,
        summary: 'Desativar notificações push neste navegador',
        description: 'Remove a inscrição com esse `endpoint` (se não existir, nada muda).',
        params: [accountId],
        body: 'PushUnsubscribeInput',
        success: { status: 200, description: 'Inscrição removida.', schema: 'MessageResponse' },
        errors: { 400: '`endpoint` não é uma URL https.', 404: 'Conta não encontrada.' }
      }), access.ownAccount())
    ],
    config: [
      route('get', '/config/push', push.pushConfig, pushOperation({
        tag: TAGS.system,
        summary: 'Configuração das notificações push',
        description: 'Chave pública VAPID para o `PushManager.subscribe()` do navegador.',
        success: { status: 200, description: 'Chave pública VAPID.', schema: 'PushConfig' },
        errors: { 503: 'VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não definida no .env.' }
      }), PUBLIC_ROUTE)
    ]
  };
}
