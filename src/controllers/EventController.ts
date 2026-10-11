import { sendFailure, toId } from '#shared/infra/http/respond';
import { APPLICATIONS_CHANGED_EVENT, openEventStream, sendEvent } from '#shared/infra/http/sse';
import type { Handler, IdParams } from '#shared/infra/http/types';
import type { WorkerUseCases } from '../usecases/WorkerUseCases';

// HTTP dos avisos em tempo real (SSE) para as telas abertas atualizarem sem recarregar.
export interface EventController {
  workerApplicationEvents: Handler<never, IdParams>;
}

export function createEventController(workers: WorkerUseCases): EventController {
  // GET /api/workers/:id/events - Avisa quando o status de uma candidatura do trabalhador muda
  const workerApplicationEvents: Handler<never, IdParams> = async (req, res) => {
    const result = await workers.watchApplications(toId(req.params.id), () => sendEvent(res, APPLICATIONS_CHANGED_EVENT));
    if (!result.ok) { sendFailure(res, result); return; }
    openEventStream(res, result.value);
  };

  return { workerApplicationEvents };
}
