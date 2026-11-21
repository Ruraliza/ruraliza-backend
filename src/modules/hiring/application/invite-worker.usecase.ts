import type { FarmerRepository } from '#modules/farmers';
import type { FarmRepository } from '#modules/farms';
import { type PushNotifier, WORKER_INVITES_URL } from '#modules/notifications';
import { type ServiceRepository, describeEstimate, describeHours } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { CatalogCheck } from '../domain/hiring-events';
import { INVITE_STATUS } from '../domain/hiring-status';
import { MAX_INVITES_PER_SERVICE } from '../domain/hiring.rules';
import type { InviteRepository } from '../domain/invite.repository';
import type { Invite } from '../hiring.contract';
import { isInviteOpen } from './invite-expiry';

export interface InviteWorkerDeps {
  services: ServiceRepository;
  farms: FarmRepository;
  farmers: FarmerRepository;
  workers: WorkerRepository;
  invites: InviteRepository;
  catalog: CatalogCheck;
  clock: Clock;
  push: PushNotifier;
}

export interface InviteWorkerInput {
  serviceId: number; // a rota já conferiu que o serviço é de quem pede (access.farmerOfService)
  workerId: number;
}

// O produtor convida um trabalhador do catálogo da vaga. A API confere de novo, agora, que ele está no
// catálogo (pode ter desligado o catálogo, trocado de categoria ou se candidatado). Um convite por vaga e
// trabalhador, no máximo MAX_INVITES_PER_SERVICE por vaga. O trabalhador recebe push, que abre os convites.
export class InviteWorkerUseCase {
  constructor(private readonly deps: InviteWorkerDeps) {}

  async execute({ serviceId, workerId }: InviteWorkerInput): Promise<Result<Invite>> {
    const { services, workers, invites, clock } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    const worker = await workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');
    const now = clock.now();
    if (!isInviteOpen(service, now)) return conflict('Só é possível convidar enquanto a vaga está aberta e no prazo.');

    const sent = await invites.find({ service_id: service.id });
    const previous = sent.find((i) => i.worker_id === worker.id);
    if (previous?.status === INVITE_STATUS.DECLINED) return conflict('Esta pessoa recusou o convite para esta vaga e não pode ser convidada de novo.');
    if (previous) return conflict('Você já convidou esta pessoa para esta vaga.');
    if (sent.length >= MAX_INVITES_PER_SERVICE) {
      return conflict(`Você já mandou ${MAX_INVITES_PER_SERVICE} convites para esta vaga, o limite por vaga.`);
    }
    if (!(await this.deps.catalog.listed(service, worker.id))) {
      return conflict('Esta pessoa não está mais no catálogo desta vaga.');
    }

    const invite = await invites.create({
      service_id: service.id,
      farmer_id: service.farmer_id,
      worker_id: worker.id,
      status: INVITE_STATUS.PENDING,
      insertion_date: now,
      answered_at: null
    });
    // A fazenda não tem nome no cadastro: vai o nome do produtor e a cidade da fazenda.
    const farm = await this.deps.farms.findById(service.farm_id);
    const farmer = await this.deps.farmers.findById(service.farmer_id);
    const place = `${farmer?.name ?? 'Um produtor'}${farm ? ` em ${farm.city}` : ''}`;
    this.deps.push.notify('worker', worker.id, {
      title: `Convite para ${service.name}`,
      body: `${place} convidou você: ${describeHours(service.duration)}, ${describeEstimate(service)}.`,
      url: WORKER_INVITES_URL
    });
    return ok(invite);
  }
}
