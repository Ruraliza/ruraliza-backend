import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import type { InviteRepository } from '../domain/invite.repository';

// Convites de um perfil removido (os que ele mandou como produtor ou recebeu como trabalhador).
export function invitesCleanup(deps: { invites: InviteRepository }): ProfileCleanup {
  const removeAll = async (criteria: { farmer_id: number } | { worker_id: number }): Promise<void> => {
    for (const invite of await deps.invites.find(criteria)) await deps.invites.delete(invite.id);
  };
  return {
    farmerRemoved: (farmerId) => removeAll({ farmer_id: farmerId }),
    workerRemoved: (workerId) => removeAll({ worker_id: workerId })
  };
}
