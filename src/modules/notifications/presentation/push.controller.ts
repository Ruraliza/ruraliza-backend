import { vapidSettings } from '#shared/config';
import type { MessageResponse } from '#shared/contracts/api';
import { toBody } from '#shared/infra/http/body';
import { sendFailure, toId } from '#shared/infra/http/respond';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { PushUseCases } from '../notifications.module';
import type { PushConfig } from '../push.contract';
import { parsePushSubscription, parsePushUnsubscribe } from './push.parsers';

// HTTP das notificações push: a chave pública e as inscrições de cada navegador na conta.
export interface PushController {
  pushConfig: Handler<PushConfig>;
  subscribePush: Handler<MessageResponse, IdParams>;
  unsubscribePush: Handler<MessageResponse, IdParams>;
}

export function createPushController(push: PushUseCases): PushController {
  // GET /api/config/push - Chave pública VAPID (VAPID_PUBLIC_KEY no .env).
  // É pública por definição: não precisa checar a origem.
  const pushConfig: Handler<PushConfig> = (_req, res) => {
    const vapid = vapidSettings();
    if (!vapid) return res.status(503).json({ error: 'Notificações push não configuradas no servidor.' });
    return res.json({ public_key: vapid.publicKey });
  };

  // POST /api/accounts/:id/push-subscriptions - Inscreve este navegador nas notificações da conta
  const subscribePush: Handler<MessageResponse, IdParams> = async (req, res) => {
    const input = parsePushSubscription(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await push.subscribe.execute({ accountId: toId(req.params.id), input: input.value });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(201).json({ message: 'Push subscription saved successfully!' });
  };

  // DELETE /api/accounts/:id/push-subscriptions - Para de enviar notificações a este navegador
  const unsubscribePush: Handler<MessageResponse, IdParams> = async (req, res) => {
    const input = parsePushUnsubscribe(toBody(req.body));
    if (!input.ok) { sendFailure(res, input); return; }

    const result = await push.unsubscribe.execute({ accountId: toId(req.params.id), endpoint: input.value.endpoint });
    if (!result.ok) { sendFailure(res, result); return; }
    res.status(200).json({ message: 'Push subscription removed successfully!' });
  };

  return { pushConfig, subscribePush, unsubscribePush };
}
