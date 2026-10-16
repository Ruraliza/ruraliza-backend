import type { ChangeFeed, ChangeTopic } from '#shared/domain/changes';
import { profileChats, profileNotifications, workerApplications } from '#shared/domain/changes';
import { toId } from '#shared/infra/http/respond';
import { APPLICATIONS_CHANGED_EVENT, CHATS_CHANGED_EVENT, NOTIFICATIONS_CHANGED_EVENT, openEventStream, sendEvent } from '#shared/infra/http/sse';
import type { Handler, IdParams } from '#shared/infra/http/types';

// Uma conexão só por perfil para tudo o que muda na tela inteira (o menu, o sino e, no trabalhador,
// as candidaturas). O navegador abre no máximo 6 conexões por servidor em HTTP/1.1: com um stream por
// assunto, duas abas do app já esgotavam o limite e as outras requisições ficavam esperando.
export interface LiveController {
  farmerLive: Handler<never, IdParams>;
  workerLive: Handler<never, IdParams>;
}

type Res = Parameters<Handler<never, IdParams>>[1];

export function createLiveController(changes: ChangeFeed): LiveController {
  function stream(res: Res, topics: readonly (readonly [ChangeTopic, string])[]): void {
    const stops: (() => void)[] = [];
    openEventStream(res, () => { for (const stop of stops) stop(); });
    for (const [topic, event] of topics) stops.push(changes.subscribe(topic, () => sendEvent(res, event)));
  }

  // GET /api/farmers/:id/live - Conversas e avisos do produtor
  const farmerLive: Handler<never, IdParams> = (req, res) => {
    const id = toId(req.params.id);
    stream(res, [[profileChats('farmer', id), CHATS_CHANGED_EVENT], [profileNotifications('farmer', id), NOTIFICATIONS_CHANGED_EVENT]]);
  };

  // GET /api/workers/:id/live - Candidaturas, conversas e avisos do trabalhador
  const workerLive: Handler<never, IdParams> = (req, res) => {
    const id = toId(req.params.id);
    stream(res, [
      [workerApplications(id), APPLICATIONS_CHANGED_EVENT],
      [profileChats('worker', id), CHATS_CHANGED_EVENT],
      [profileNotifications('worker', id), NOTIFICATIONS_CHANGED_EVENT]
    ]);
  };

  return { farmerLive, workerLive };
}
