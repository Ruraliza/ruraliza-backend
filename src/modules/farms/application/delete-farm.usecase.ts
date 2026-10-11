import type { Clock } from '#shared/domain/clock';
import { type Result, conflict, ok } from '#shared/domain/result';
import { SERVICE_STATUS, type ServiceRepository, type ServiceStatus } from '#modules/services';
import type { FarmerRepository } from '../../../domain/repositories';
import type { FarmRepository } from '../domain/farm.repository';
import { findOwnFarm } from './find-own-farm';

const ACTIVE_SERVICE: readonly ServiceStatus[] = [SERVICE_STATUS.PENDING, SERVICE_STATUS.IN_PROGRESS];

export interface DeleteFarmDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  clock: Clock;
}

export interface DeleteFarmInput {
  farmerId: number;
  farmId: number;
}

// Remove a fazenda arquivando (deleted_at), para preservar o histórico dos serviços.
// Bloqueia com serviço ativo (Pending/In Progress); serviços encerrados continuam com a fazenda.
export class DeleteFarmUseCase {
  constructor(private readonly deps: DeleteFarmDeps) {}

  async execute({ farmerId, farmId }: DeleteFarmInput): Promise<Result<null>> {
    const found = await findOwnFarm(this.deps, farmerId, farmId);
    if (!found.ok) return found;

    const { farmer, farm } = found.value;
    const farmServices = await this.deps.services.find({ farm_id: farm.id });
    if (farmServices.some((s) => ACTIVE_SERVICE.includes(s.status))) {
      return conflict('Não é possível remover: a fazenda tem serviços abertos ou em andamento. Cancele ou conclua-os antes.');
    }

    farm.deleted_at = this.deps.clock.now();
    await this.deps.farms.update(farm);
    farmer.farms = farmer.farms.filter((id) => id !== farm.id);
    await this.deps.farmers.update(farmer);

    return ok(null);
  }
}
