import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import { type Result, notFound, ok, requireFound } from '#shared/domain/result';
import { toPublicProfile } from '#shared/utils/profile';
import type { ApplicationRepository } from '../domain/application.repository';
import type { ApplicationWithWorker } from '../hiring.contract';

export interface ListServiceApplicationsDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  workers: WorkerRepository;
}

export interface ListServiceApplicationsInput {
  serviceId: number;
}

// Candidaturas do serviço com o trabalhador embutido (CPF mascarado).
export class ListServiceApplicationsUseCase {
  constructor(private readonly deps: ListServiceApplicationsDeps) {}

  async execute({ serviceId }: ListServiceApplicationsInput): Promise<Result<ApplicationWithWorker[]>> {
    const { services, applications, workers } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const own = await applications.find({ service_id: service.id });
    const result = await Promise.all(
      own.map(async (a): Promise<ApplicationWithWorker> => {
        const worker = requireFound(await workers.findById(a.worker_id), `trabalhador da candidatura ${a.id}`);
        return { ...a, worker: toPublicProfile(worker) };
      })
    );
    return ok(result);
  }
}
