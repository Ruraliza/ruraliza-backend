import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import { type Result, notFound, ok, requireFound } from '#shared/domain/result';
import { toPublicProfile } from '#shared/utils/profile';
import { maskEmail, maskPhone } from '#shared/utils/validation';
import type { ApplicationRepository } from '../domain/application.repository';
import type { WorkerReputationReader } from '../domain/hiring-events';
import type { ApplicationWithWorker } from '../hiring.contract';

export interface ListServiceApplicationsDeps {
  services: ServiceRepository;
  applications: ApplicationRepository;
  workers: WorkerRepository;
  reputation: WorkerReputationReader;
}

export interface ListServiceApplicationsInput {
  serviceId: number;
}

// Candidaturas do serviço com o trabalhador embutido e a reputação dele. CPF, telefone e e-mail saem
// mascarados: o contato só é trocado pela conversa, quando os dois liberam o WhatsApp.
export class ListServiceApplicationsUseCase {
  constructor(private readonly deps: ListServiceApplicationsDeps) {}

  async execute({ serviceId }: ListServiceApplicationsInput): Promise<Result<ApplicationWithWorker[]>> {
    const { services, applications, workers } = this.deps;
    const service = await services.findById(serviceId);
    if (!service) return notFound('Serviço não encontrado.');

    const own = await applications.find({ service_id: service.id });
    const reputations = await this.deps.reputation.forWorkers(own.map((a) => a.worker_id));
    const result = await Promise.all(
      own.map(async (a): Promise<ApplicationWithWorker> => {
        const worker = requireFound(await workers.findById(a.worker_id), `trabalhador da candidatura ${a.id}`);
        const masked = { ...toPublicProfile(worker), phone: maskPhone(worker.phone), email: maskEmail(worker.email) };
        return { ...a, worker: masked, reputation: requireFound(reputations.get(a.worker_id), `reputação do trabalhador ${a.worker_id}`) };
      })
    );
    return ok(result);
  }
}
