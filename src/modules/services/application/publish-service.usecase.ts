import { type FarmRepository, findActiveFarm } from '#modules/farms';
import type { Clock } from '#shared/domain/clock';
import { type Result, invalid, notFound, ok } from '#shared/domain/result';
import type { FarmerRepository } from '../../../domain/repositories';
import type { Service, ServiceInput } from '../service.contract';
import type { ServiceRepository } from '../domain/service.repository';
import { SERVICE_STATUS } from '../domain/service-status';
import { checkExpiry } from '../domain/service.rules';

export interface PublishServiceDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  clock: Clock;
}

// RF01 - Publica um serviço Pending numa fazenda ativa do produtor.
export class PublishServiceUseCase {
  constructor(private readonly deps: PublishServiceDeps) {}

  async execute(input: ServiceInput): Promise<Result<Service>> {
    const farmer = await this.deps.farmers.findById(input.farmer_id);
    if (!farmer) return notFound('Produtor não encontrado.');

    const farm = await findActiveFarm(this.deps.farms, input.farm_id);
    if (!farm) return notFound('Fazenda não encontrada.');
    if (farm.farmer_id !== farmer.id) return invalid('Esta fazenda não pertence a este produtor.');

    const expiry = checkExpiry(input.expires_at, this.deps.clock.now());
    if (!expiry.ok) return expiry;

    const service = await this.deps.services.create({
      farmer_id: farmer.id,
      farm_id: farm.id,
      worker_id: null,
      payment_id: null,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      duration: input.duration,
      price: input.price,
      expires_at: input.expires_at ?? null,
      status: SERVICE_STATUS.PENDING,
      insertion_date: this.deps.clock.now()
    });
    return ok(service);
  }
}
