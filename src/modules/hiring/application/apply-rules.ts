import { type AccountRepository, findAccountOf } from '#modules/accounts';
import { SERVICE_STATUS, type Service, isExpired } from '#modules/services';
import type { Worker } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, ok } from '#shared/domain/result';
import type { ApplicationRepository } from '../domain/application.repository';
import { APPLICATION_STATUS, INVITE_STATUS } from '../domain/hiring-status';
import type { HiringTransaction } from '../domain/hiring-transaction';
import type { Invite, ServiceApplication } from '../hiring.contract';

export interface ApplyRulesDeps {
  applications: ApplicationRepository;
  accounts: AccountRepository;
  clock: Clock;
}

// Regras de quem pode virar candidato de uma vaga, valem para a candidatura e para o aceite de um convite:
// a vaga é de outra pessoa, está aberta e no prazo, e o trabalhador não foi recusado nem já se candidatou.
export async function checkCanApply(deps: ApplyRulesDeps, service: Service, worker: Worker): Promise<Result<null>> {
  // Conta com os dois perfis: o trabalhador não concorre ao serviço que ele mesmo publicou.
  const account = await findAccountOf(deps.accounts, 'worker', worker.id);
  if (account?.farmer_id === service.farmer_id) {
    return conflict('Você não pode se candidatar a um serviço que você mesmo publicou.');
  }
  if (service.status !== SERVICE_STATUS.PENDING) {
    return conflict('Este serviço não está mais aberto para candidaturas.');
  }
  if (isExpired(service, deps.clock.now())) {
    return conflict('O prazo para se candidatar a esta vaga terminou.');
  }
  const existing = await deps.applications.find({ service_id: service.id, worker_id: worker.id });
  if (existing.some((a) => a.status === APPLICATION_STATUS.REJECTED)) {
    return conflict('Sua candidatura a este serviço foi recusada e você não pode se candidatar novamente.');
  }
  if (existing.length > 0) return conflict('Você já se candidatou a este serviço.');
  return ok(null);
}

// Cria a candidatura (Pending). Com um convite pendente, ele vira Accepted e a candidatura sai `invited`,
// as duas coisas juntas. As regras de checkCanApply já foram conferidas.
export function saveApplication(
  transaction: HiringTransaction,
  data: { service: Service; workerId: number; message?: string; invite?: Invite; now: string }
): Promise<{ application: ServiceApplication; invite?: Invite }> {
  const { service, workerId, message, invite, now } = data;
  return transaction(async (stores) => {
    const application = await stores.applications.create({
      service_id: service.id,
      worker_id: workerId,
      status: APPLICATION_STATUS.PENDING,
      ...(message ? { message } : {}),
      invited: invite !== undefined,
      insertion_date: now
    });
    if (!invite) return { application };
    const accepted: Invite = { ...invite, status: INVITE_STATUS.ACCEPTED, answered_at: now };
    await stores.invites.update(accepted);
    return { application, invite: accepted };
  });
}
