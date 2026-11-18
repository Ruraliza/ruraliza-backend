import { type Schema, input, object } from '#shared/infra/docs/schema-kit';

// Schemas OpenAPI das notificações push (contrato em ../push.contract.ts). Registrados em src/docs/schemas.ts.
export type PushSchemaName = 'PushConfig' | 'PushSubscriptionInput' | 'PushUnsubscribeInput';

export const pushSchemas = {
  PushConfig: object(
    { public_key: { type: 'string', example: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' } },
    ['public_key'],
    'Chave pública VAPID (base64url) para o PushManager.subscribe().'
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
  )
} satisfies Record<PushSchemaName, Schema>;
