import type { SystemUserRepository } from '#modules/system-users';
import { type Result, invalid, ok } from '#shared/domain/result';

// Os tutores de uma trilha precisam ser usuários de sistema com cargo tutor (ao menos um).
export async function checkTutors(systemUsers: SystemUserRepository, ids: readonly number[]): Promise<Result<number[]>> {
  if (ids.length === 0) return invalid('A trilha precisa de pelo menos um tutor.');
  const tutors = new Set((await systemUsers.find()).filter((u) => u.role === 'tutor').map((u) => u.id));
  const unknown = ids.filter((id) => !tutors.has(id));
  if (unknown.length > 0) return invalid(`Não são tutores: ${unknown.join(', ')}.`);
  return ok([...new Set(ids)]);
}
