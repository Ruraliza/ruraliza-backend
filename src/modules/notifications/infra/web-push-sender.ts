import webpush, { WebPushError } from 'web-push';
import type { PushDelivery, PushMessage, PushSender, PushSubscriptionRecord } from '#modules/notifications';
import { vapidSettings } from '#shared/config';

// Payload no formato que o service worker do Angular (@angular/service-worker) entende:
// ele mostra `notification` e, no clique, abre/foca o app na `url` (relativa ao escopo do app).
export function toAngularPayload(message: PushMessage): string {
  return JSON.stringify({
    notification: {
      title: message.title,
      body: message.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/badge-96.png',
      lang: 'pt-BR',
      data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: message.url } } }
    }
  });
}

// Envio pelo protocolo Web Push, com as chaves VAPID do .env (lidas a cada envio, como o resto da config).
// Sem chaves, não envia nada.
export class WebPushSender implements PushSender {
  async send(subscription: PushSubscriptionRecord, message: PushMessage): Promise<PushDelivery> {
    const vapid = vapidSettings();
    if (!vapid) return 'sent';

    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        toAngularPayload(message),
        { vapidDetails: vapid, TTL: 60 * 60 * 24 }
      );
      return 'sent';
    } catch (error) {
      // 404/410: a inscrição expirou ou foi revogada no navegador.
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return 'gone';
      throw error;
    }
  }
}
