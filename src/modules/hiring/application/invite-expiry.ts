import { SERVICE_STATUS, type Service, isExpired } from '#modules/services';
import { INVITE_STATUS } from '../domain/hiring-status';
import type { InviteRepository } from '../domain/invite.repository';
import type { Invite } from '../hiring.contract';

// Os convites pendentes expiram quando a vaga sai de Pending (aceite de alguém, cancelamento) ou vence.
// O aceite e o cancelamento marcam na hora (expirePendingInvites); o prazo é conferido na leitura
// (refreshInvite), sempre que o convite é listado ou respondido.

export function isInviteOpen(service: Service, now: string): boolean {
  return service.status === SERVICE_STATUS.PENDING && !isExpired(service, now);
}

export async function expirePendingInvites(invites: InviteRepository, serviceId: number): Promise<number[]> {
  const expired: number[] = [];
  for (const invite of await invites.find({ service_id: serviceId, status: INVITE_STATUS.PENDING })) {
    await invites.update({ ...invite, status: INVITE_STATUS.EXPIRED });
    expired.push(invite.worker_id);
  }
  return expired;
}

// O convite como ele está agora: pendente com a vaga fechada ou vencida vira Expired (e fica gravado).
export async function refreshInvite(invites: InviteRepository, invite: Invite, service: Service, now: string): Promise<Invite> {
  if (invite.status !== INVITE_STATUS.PENDING || isInviteOpen(service, now)) return invite;
  const expired: Invite = { ...invite, status: INVITE_STATUS.EXPIRED };
  await invites.update(expired);
  return expired;
}
