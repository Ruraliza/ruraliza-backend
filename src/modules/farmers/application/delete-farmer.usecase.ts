import { type AccountRepository, unlinkProfile } from '#modules/accounts';
import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository } from '#modules/hiring';
import type { PushSubscriptionRepository } from '#modules/notifications';
import { SERVICE_STATUS, type ServiceRepository } from '#modules/services';
import { type ChangeFeed, workerApplications } from '#shared/domain/changes';
import { type ImageStore, releaseImage } from '#shared/domain/images';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { FarmerRepository } from '../domain/farmer.repository';

export interface DeleteFarmerDeps {
  farmers: FarmerRepository;
  farms: FarmRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  accounts: AccountRepository;
  pushSubscriptions: PushSubscriptionRepository;
  images: ImageStore;
  changes: ChangeFeed;
}

// Remove em cascata: candidaturas → serviços → fazendas (e fotos) → foto de perfil → perfil na conta
// → produtor. Os pagamentos ficam como histórico. Bloqueado enquanto houver serviço em andamento.
export class DeleteFarmerUseCase {
  constructor(private readonly deps: DeleteFarmerDeps) {}

  async execute({ farmerId }: { farmerId: number }): Promise<Result<null>> {
    const { farmers, farms, services, applications, images } = this.deps;
    const farmer = await farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const ownServices = await services.find({ farmer_id: farmer.id });
    if (ownServices.some((s) => s.status === SERVICE_STATUS.IN_PROGRESS)) {
      return conflict('Não é possível remover: há serviço em andamento. Conclua o pagamento antes.');
    }

    // TODO(db): numa transação, ou com ON DELETE CASCADE.
    const applicants = new Set<number>();
    for (const service of ownServices) {
      for (const application of await applications.find({ service_id: service.id })) {
        await applications.delete(application.id);
        applicants.add(application.worker_id);
      }
      await services.delete(service.id);
    }
    for (const farm of await farms.find({ farmer_id: farmer.id })) {
      for (const photo of farm.photos) await images.delete(photo.id);
      await farms.delete(farm.id);
    }
    await releaseImage(images, farmer.photo_url);
    await unlinkProfile(this.deps, 'farmer', farmer.id);
    await farmers.delete(farmer.id);
    // As candidaturas somem da tela "Candidaturas" de quem se candidatou.
    this.deps.changes.publish([...applicants].map(workerApplications));

    return ok(null);
  }
}
