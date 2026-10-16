import { type Result, invalid, ok } from '#shared/domain/result';
import type { Body } from '#shared/infra/http/body';
import type { NotificationsReadInput } from '../notification.contract';

// POST .../notifications/read: sem corpo (ou sem `ids`) marca todos; com `ids`, só esses.
export function parseNotificationsRead(body: Body): Result<NotificationsReadInput> {
  const ids = body['ids'];
  if (ids === undefined) return ok({});
  if (!Array.isArray(ids) || !ids.every((id): id is number => Number.isInteger(id) && (id as number) > 0)) {
    return invalid('Os avisos (ids) devem ser uma lista de números inteiros positivos.');
  }
  return ok({ ids });
}
