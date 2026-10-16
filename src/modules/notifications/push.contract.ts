// Notificações push (Web Push). A inscrição vem de PushManager.subscribe() no navegador.

// POST /accounts/:id/push-subscriptions: o PushSubscription.toJSON() do navegador, só com o que o envio usa.
export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// DELETE /accounts/:id/push-subscriptions: qual inscrição (aparelho/navegador) remover.
export interface PushUnsubscribeInput {
  endpoint: string;
}

// GET /config/push: chave pública VAPID para o PushManager.subscribe().
export interface PushConfig {
  public_key: string;
}

// GET /config/whatsapp: se o servidor está configurado para mandar avisos por WhatsApp
// (o app só oferece a opção quando está).
export interface WhatsAppConfig {
  enabled: boolean;
}
