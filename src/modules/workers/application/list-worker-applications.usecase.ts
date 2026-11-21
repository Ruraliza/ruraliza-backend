import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository, ApplicationWithService } from '#modules/hiring';
import { type ServicePaymentReader, type ServiceRepository, toOpenService } from '#modules/services';
import { type Result, notFound, ok, requireFound } from '#shared/domain/result';
import type { WorkerRepository } from '../domain/worker.repository';

export interface ListWorkerApplicationsDeps {
  workers: WorkerRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  farms: FarmRepository;
  servicePayments: ServicePaymentReader;
}

// Candidaturas do trabalhador com o serviço embutido (o ponto no mapa só nos serviços em que foi aceito).
export class ListWorkerApplicationsUseCase {
  constructor(private readonly deps: ListWorkerApplicationsDeps) {}

  async execute({ workerId }: { workerId: number }): Promise<Result<ApplicationWithService[]>> {
    const { workers, services, applications, farms, servicePayments } = this.deps;
    const worker = await workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const own = await applications.find({ worker_id: worker.id });
    const result = await Promise.all(
      own.map(async (a): Promise<ApplicationWithService> => {
        const service = requireFound(await services.findById(a.service_id), `serviço da candidatura ${a.id}`);
        return { ...a, service: await toOpenService(farms, service, worker.id, servicePayments) };
      })
    );
    return ok(result);
  }
}
