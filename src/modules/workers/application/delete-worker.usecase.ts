import { type AccountRepository, unlinkProfile } from '#modules/accounts';
import type { ApplicationRepository } from '#modules/hiring';
import type { PushSubscriptionRepository } from '#modules/notifications';
import { SERVICE_STATUS, type ServiceRepository } from '#modules/services';
import { type ChangeFeed, serviceApplications } from '#shared/domain/changes';
import { type DocumentStore, releaseDocument } from '#shared/domain/documents';
import { type ImageStore, releaseImage } from '#shared/domain/images';
import type { ProfileCleanup } from '#shared/domain/profile-cleanup';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { WorkerRepository } from '../domain/worker.repository';

export interface DeleteWorkerDeps {
  workers: WorkerRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  images: ImageStore;
  documents: DocumentStore;
  changes: ChangeFeed;
  cleanup: ProfileCleanup;
}

// As candidaturas embutem o perfil do trabalhador, então saem junto com ele (e a foto, o currículo,
// as conversas, as avaliações e o perfil na conta). Bloqueado enquanto houver serviço em andamento atribuído a ele.
export class DeleteWorkerUseCase {
  constructor(private readonly deps: DeleteWorkerDeps) {}

  async execute({ workerId }: { workerId: number }): Promise<Result<null>> {
    const { workers, services, applications } = this.deps;
    const worker = await workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const inProgress = await services.find({ worker_id: worker.id, status: SERVICE_STATUS.IN_PROGRESS });
    if (inProgress.length > 0) {
      return conflict('Não é possível remover: há serviço em andamento atribuído a este trabalhador.');
    }

    // TODO(db): numa transação, ou com ON DELETE CASCADE.
    await this.deps.cleanup.workerRemoved(worker.id);
    const own = await applications.find({ worker_id: worker.id });
    for (const application of own) {
      await applications.delete(application.id);
    }
    // Some das listas de candidatos dos serviços em que se candidatou.
    this.deps.changes.publish(own.map((a) => serviceApplications(a.service_id)));
    await releaseImage(this.deps.images, worker.photo_url);
    await releaseDocument(this.deps.documents, worker.resume_url);
    await unlinkProfile(this.deps, 'worker', worker.id);
    await workers.delete(worker.id);

    return ok(null);
  }
}
