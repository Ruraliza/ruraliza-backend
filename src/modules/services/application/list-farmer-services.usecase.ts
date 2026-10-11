import { type FarmRepository, farmOf } from '#modules/farms';
import { APPLICATION_STATUS, type ApplicationRepository } from '#modules/hiring';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { FarmerRepository } from '../../../domain/repositories';
import type { ServiceRepository } from '../domain/service.repository';
import type { FarmerServiceItem, ServiceStatus } from '../service.contract';

export interface ListFarmerServicesDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
}

export interface ListFarmerServicesInput {
  farmerId: number;
  status?: ServiceStatus | undefined;
}

// Serviços do produtor, com a fazenda e a contagem de candidaturas pendentes.
export class ListFarmerServicesUseCase {
  constructor(private readonly deps: ListFarmerServicesDeps) {}

  async execute({ farmerId, status }: ListFarmerServicesInput): Promise<Result<FarmerServiceItem[]>> {
    const { farmers, farms, services, applications } = this.deps;
    const farmer = await farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const own = await services.find(status === undefined ? { farmer_id: farmer.id } : { farmer_id: farmer.id, status });
    const result = await Promise.all(
      own.map(async (s): Promise<FarmerServiceItem> => ({
        ...s,
        farm: await farmOf(farms, s),
        applications_pending: (await applications.find({ service_id: s.id, status: APPLICATION_STATUS.PENDING })).length
      }))
    );
    return ok(result);
  }
}
