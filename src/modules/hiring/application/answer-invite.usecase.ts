import { type PushNotifier, chatUrl, farmerServiceUrl } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { ChangeFeed } from '#shared/domain/changes';
import { type Result, conflict, forbidden, notFound, ok, requireFound } from '#shared/domain/result';
import type { HiringEvents } from '../domain/hiring-events';
import { INVITE_STATUS } from '../domain/hiring-status';
import type { HiringTransaction } from '../domain/hiring-transaction';
import type { InviteRepository } from '../domain/invite.repository';
import type { Invite, InviteAnswer, ServiceApplication } from '../hiring.contract';
import { type ApplyRulesDeps, checkCanApply, saveApplication } from './apply-rules';
import { publishApplicationChanges } from './hiring-notifications';
import { refreshInvite } from './invite-expiry';

export interface AnswerInviteDeps extends ApplyRulesDeps {
  services: ServiceRepository;
  workers: WorkerRepository;
  invites: InviteRepository;
  transaction: HiringTransaction;
  changes: ChangeFeed;
  push: PushNotifier;
  events: HiringEvents;
}

export interface AnswerInviteInput {
  inviteId: number;
  workerId: number | null; // perfil de trabalhador da conta que responde
  action: InviteAnswer;
}

export interface AnswerInviteOutcome {
  invite: Invite;
  application?: ServiceApplication;
  chatId?: number;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

// Só o convidado responde, e uma vez. Aceitar segue as regras da candidatura: a candidatura (Pending,
// `invited`) e o convite Accepted são gravados juntos, e depois a conversa abre sozinha e o produtor recebe
// push. Recusar avisa o produtor e impede um novo convite para a mesma vaga. Convite expirado não se responde.
export class AnswerInviteUseCase {
  constructor(private readonly deps: AnswerInviteDeps) {}

  async execute({ inviteId, workerId, action }: AnswerInviteInput): Promise<Result<AnswerInviteOutcome>> {
    const { services, workers, invites, clock, push } = this.deps;
    const found = await invites.findById(inviteId);
    if (!found) return notFound('Convite não encontrado.');
    if (workerId === null || found.worker_id !== workerId) return forbidden('Você não tem acesso a este convite.');
    const service = await services.findById(found.service_id);
    if (!service) return notFound('Serviço não encontrado.');
    const now = clock.now();

    const invite = await refreshInvite(invites, found, service, now);
    if (invite.status === INVITE_STATUS.EXPIRED) return conflict('Este convite expirou: a vaga não está mais aberta.');
    if (invite.status !== INVITE_STATUS.PENDING) return conflict('Este convite já foi respondido.');
    const worker = requireFound(await workers.findById(invite.worker_id), `trabalhador ${invite.worker_id}`);

    if (action === 'Decline') {
      const declined: Invite = { ...invite, status: INVITE_STATUS.DECLINED, answered_at: now };
      await invites.update(declined);
      push.notify('farmer', service.farmer_id, {
        title: 'Convite recusado',
        body: `${firstName(worker.name)} não pode aceitar o convite para ${service.name}.`,
        url: farmerServiceUrl(service.id)
      });
      return ok({ invite: declined });
    }

    const allowed = await checkCanApply(this.deps, service, worker);
    if (!allowed.ok) return allowed;
    const saved = await saveApplication(this.deps.transaction, { service, workerId: worker.id, invite, now });
    const accepted = requireFound(saved.invite, `convite ${invite.id}`);

    publishApplicationChanges(this.deps.changes, service.id, [worker.id]);
    const chatId = await this.deps.events.inviteAccepted(service, saved.application);
    push.notify('farmer', service.farmer_id, {
      title: `${firstName(worker.name)} aceitou seu convite`,
      body: `Conversem sobre ${service.name} pela conversa.`,
      url: chatId === null ? farmerServiceUrl(service.id) : chatUrl('farmer', chatId)
    });
    return ok({ invite: accepted, application: saved.application, ...(chatId === null ? {} : { chatId }) });
  }
}
