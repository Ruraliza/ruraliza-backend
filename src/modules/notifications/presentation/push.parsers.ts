import { type Result, invalid, ok } from '#shared/domain/result';
import { type Body, isRecord } from '#shared/infra/http/body';
import type { PushSubscriptionInput, PushUnsubscribeInput } from '../push.contract';

// Formato dos corpos das rotas de inscrição de push (400).

// Endpoint do serviço de push do navegador (FCM, Mozilla, Apple...): sempre https.
function parsePushEndpoint(value: unknown): Result<string> {
  if (typeof value !== 'string' || !URL.canParse(value) || new URL(value).protocol !== 'https:') {
    return invalid('endpoint deve ser a URL https da inscrição de push.');
  }
  return ok(value);
}

export function parsePushSubscription(body: Body): Result<PushSubscriptionInput> {
  const endpoint = parsePushEndpoint(body['endpoint']);
  if (!endpoint.ok) return endpoint;

  const keys = body['keys'];
  const p256dh = isRecord(keys) ? keys['p256dh'] : undefined;
  const auth = isRecord(keys) ? keys['auth'] : undefined;
  if (typeof p256dh !== 'string' || !p256dh || typeof auth !== 'string' || !auth) {
    return invalid('Envie keys.p256dh e keys.auth da inscrição de push.');
  }
  return ok({ endpoint: endpoint.value, keys: { p256dh, auth } });
}

export function parsePushUnsubscribe(body: Body): Result<PushUnsubscribeInput> {
  const endpoint = parsePushEndpoint(body['endpoint']);
  return endpoint.ok ? ok({ endpoint: endpoint.value }) : endpoint;
}
