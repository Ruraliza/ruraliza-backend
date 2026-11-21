import type { FarmRepository } from '#modules/farms';
import { type ServiceRepository, toOpenService } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { type Result, notFound, ok } from '#shared/domain/result';
import { INVITE_STATUS } from '../domain/hiring-status';
import type { InviteRepository } from '../domain/invite.repository';
import type { InviteWithService } from '../hiring.contract';
import { refreshInvite } from './invite-expiry';

export interface ListWorkerInvitesDeps {
  services: ServiceRepository;
  farms: FarmRepository;
  workers: WorkerRepository;
  invites: InviteRepository;
  clock: Clock;
}

// Convites do trabalhador com a vaga: os pendentes primeiro, depois os mais recentes. Os pendentes de vagas
// fechadas ou vencidas saem (e ficam gravados) como Expired.
export class ListWorkerInvitesUseCase {
  constructor(private readonly deps: ListWorkerInvitesDeps) {}

  async execute({ workerId }: { workerId: number }): Promise<Result<InviteWithService[]>> {
    const { services, farms, workers, invites, clock } = this.deps;
    if (!(await workers.findById(workerId))) return notFound('Trabalhador não encontrado.');
    const now = clock.now();
    const list: InviteWithService[] = [];
    for (const found of await invites.find({ worker_id: workerId })) {
      const service = await services.findById(found.service_id);
      if (!service) continue;
      const invite = await refreshInvite(invites, found, service, now);
      list.push({ ...invite, service: await toOpenService(farms, service, workerId) });
    }
    const pendingFirst = (status: string): number => (status === INVITE_STATUS.PENDING ? 0 : 1);
    list.sort((a, b) => pendingFirst(a.status) - pendingFirst(b.status) || b.insertion_date.localeCompare(a.insertion_date) || b.id - a.id);
    return ok(list);
  }
}
