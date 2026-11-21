import type { AccountRepository } from '#modules/accounts';
import { type PushNotifier, farmerServiceUrl } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { maskContacts } from '#shared/domain/contacts';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { ApplicationRepository } from '../domain/application.repository';
import { INVITE_STATUS } from '../domain/hiring-status';
import type { HiringTransaction } from '../domain/hiring-transaction';
import type { InviteRepository } from '../domain/invite.repository';
import type { ServiceApplication } from '../hiring.contract';
import { checkCanApply, saveApplication } from './apply-rules';
import { publishApplicationChanges } from './hiring-notifications';

export interface ApplyForServiceDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  invites: InviteRepository;
  transaction: HiringTransaction;
  workers: WorkerRepository;
  accounts: AccountRepository;
  clock: Clock;
  changes: ChangeFeed;
  push: PushNotifier;
}

export interface ApplyForServiceInput {
  serviceId: number;
  workerId: number;
  message?: string; // já validada (tamanho e palavrões)
}

// RF02 - Candidata-se a um serviço aberto (uma vez por serviço) e avisa o produtor. A mensagem opcional
// aparece na lista de candidatos, com telefone e e-mail ocultos (o contato só é trocado depois do aceite).
// Quem tinha um convite pendente para a vaga e se candidata direto aceita o convite junto (sai "Convidado").
export class ApplyForServiceUseCase {
  constructor(private readonly deps: ApplyForServiceDeps) {}

  async execute({ serviceId, workerId, message }: ApplyForServiceInput): Promise<Result<ServiceApplication>> {
    const { services, workers } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    const worker = await workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const allowed = await checkCanApply(this.deps, service, worker);
    if (!allowed.ok) return allowed;

    const [invite] = await this.deps.invites.find({ service_id: service.id, worker_id: worker.id, status: INVITE_STATUS.PENDING });
    const { application } = await saveApplication(this.deps.transaction, {
      service,
      workerId: worker.id,
      ...(message ? { message: maskContacts(message).text } : {}),
      ...(invite ? { invite } : {}),
      now: this.deps.clock.now()
    });

    publishApplicationChanges(this.deps.changes, service.id, [worker.id]);
    this.deps.push.notify('farmer', service.farmer_id, {
      title: 'Nova candidatura',
      body: `${worker.name} se candidatou a ${service.name}.`,
      url: farmerServiceUrl(service.id)
    });
    return ok(application);
  }
}
