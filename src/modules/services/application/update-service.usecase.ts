import { type FarmRepository, findActiveFarm } from '#modules/farms';
import type { ChangeFeed } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, invalid, notFound, ok } from '#shared/domain/result';
import type { ApplicationRepository } from '../../../domain/repositories';
import type { Service, ServiceUpdate } from '../service.contract';
import type { ServiceRepository } from '../domain/service.repository';
import { SERVICE_STATUS } from '../domain/service-status';
import { checkExpiry } from '../domain/service.rules';
import { notifyApplicants } from './notify-applicants';

export interface UpdateServiceDeps {
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  clock: Clock;
  changes: ChangeFeed;
}

export interface UpdateServiceInput {
  serviceId: number;
  changes: ServiceUpdate;
}

// Edição parcial, só enquanto Pending (sem trabalhador aceito). Renovar a validade reabre a vaga vencida.
export class UpdateServiceUseCase {
  constructor(private readonly deps: UpdateServiceDeps) {}

  async execute({ serviceId, changes }: UpdateServiceInput): Promise<Result<Service>> {
    const service = await this.deps.services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');
    if (service.status !== SERVICE_STATUS.PENDING) {
      return conflict('Só é possível editar serviços que ainda aguardam candidatos.');
    }

    if (changes.farm_id !== undefined) {
      const farm = await findActiveFarm(this.deps.farms, changes.farm_id);
      if (!farm) return notFound('Fazenda não encontrada.');
      if (farm.farmer_id !== service.farmer_id) return invalid('Esta fazenda não pertence a este produtor.');
      service.farm_id = farm.id;
    }
    if (changes.expires_at !== undefined) {
      const expiry = checkExpiry(changes.expires_at, this.deps.clock.now());
      if (!expiry.ok) return expiry;
      service.expires_at = changes.expires_at;
    }
    if (changes.name !== undefined) service.name = changes.name;
    if (changes.description !== undefined) service.description = changes.description;
    if (changes.category !== undefined) service.category = changes.category;
    if (changes.duration !== undefined) service.duration = changes.duration;
    if (changes.price !== undefined) service.price = changes.price;
    await this.deps.services.update(service);
    await notifyApplicants(this.deps, service.id);

    return ok(service);
  }
}
