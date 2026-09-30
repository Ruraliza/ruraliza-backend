import type { Farm, FarmInput, FarmUpdate, Farmer, ServiceStatus } from '../contracts';
import { SERVICE_STATUS } from '../constants/status';
import type { Clock } from '../domain/clock';
import type { FarmRepository, FarmerRepository, ServiceRepository } from '../domain/repositories';
import { type Result, conflict, notFound, ok } from '../domain/result';
import { findActiveFarm, isActiveFarm } from './shared';

const ACTIVE_SERVICE: readonly ServiceStatus[] = [SERVICE_STATUS.PENDING, SERVICE_STATUS.IN_PROGRESS];

// Fazendas do produtor. A remoção arquiva (deleted_at) para preservar o histórico dos serviços.
export class FarmUseCases {
  constructor(
    private readonly repos: { farmers: FarmerRepository; farms: FarmRepository; services: ServiceRepository },
    private readonly clock: Clock
  ) {}

  // Só as fazendas ativas.
  async list(farmerId: number): Promise<Result<Farm[]>> {
    const farmer = await this.repos.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const farms = await this.repos.farms.find({ farmer_id: farmer.id });
    return ok(farms.filter(isActiveFarm));
  }

  async create(farmerId: number, input: FarmInput): Promise<Result<Farm>> {
    const farmer = await this.repos.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const farm = await this.repos.farms.create({ farmer_id: farmer.id, ...input, photos: [], insertion_date: this.clock.now() });
    farmer.farms.push(farm.id);
    await this.repos.farmers.update(farmer);

    return ok(farm);
  }

  async update(farmerId: number, farmId: number, changes: FarmUpdate): Promise<Result<Farm>> {
    const found = await this.findOwn(farmerId, farmId);
    if (!found.ok) return found;

    const { farm } = found.value;
    if (changes.address !== undefined) farm.address = changes.address;
    if (changes.city !== undefined) farm.city = changes.city;
    if (changes.state !== undefined) farm.state = changes.state;
    await this.repos.farms.update(farm);

    return ok(farm);
  }

  // Bloqueia com serviço ativo (Pending/In Progress); serviços encerrados continuam com a fazenda.
  async delete(farmerId: number, farmId: number): Promise<Result<null>> {
    const found = await this.findOwn(farmerId, farmId);
    if (!found.ok) return found;

    const { farmer, farm } = found.value;
    const farmServices = await this.repos.services.find({ farm_id: farm.id });
    if (farmServices.some((s) => ACTIVE_SERVICE.includes(s.status))) {
      return conflict('Não é possível remover: a fazenda tem serviços abertos ou em andamento. Cancele ou conclua-os antes.');
    }

    farm.deleted_at = this.clock.now();
    await this.repos.farms.update(farm);
    farmer.farms = farmer.farms.filter((id) => id !== farm.id);
    await this.repos.farmers.update(farmer);

    return ok(null);
  }

  // Fazenda ativa que pertence ao produtor da rota.
  private async findOwn(farmerId: number, farmId: number): Promise<Result<{ farmer: Farmer; farm: Farm }>> {
    const farmer = await this.repos.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const farm = await findActiveFarm(this.repos.farms, farmId);
    if (!farm || farm.farmer_id !== farmer.id) return notFound('Fazenda não encontrada.');

    return ok({ farmer, farm });
  }
}
