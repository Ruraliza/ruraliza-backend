import type { Farmer, FarmerInput, FarmerUpdate } from '../contracts';
import { SERVICE_STATUS } from '../constants/status';
import type { Clock } from '../domain/clock';
import type { ImageStore } from '../domain/images';
import type { ApplicationRepository, FarmRepository, FarmerRepository, ServiceRepository } from '../domain/repositories';
import { type Result, conflict, notFound, ok } from '../domain/result';
import { toPublicProfile } from '../utils/profile';
import { releaseImage } from './PhotoUseCases';
import { checkProfileUnique } from './shared';

// Cadastro, edição e remoção de produtores.
export class FarmerUseCases {
  constructor(
    private readonly repos: {
      farmers: FarmerRepository;
      farms: FarmRepository;
      services: ServiceRepository;
      applications: ApplicationRepository;
    },
    private readonly clock: Clock,
    private readonly images: ImageStore
  ) {}

  // Lista com CPF mascarado.
  async list(): Promise<Farmer[]> {
    return (await this.repos.farmers.find()).map(toPublicProfile);
  }

  // Perfil completo (CPF sem máscara).
  async get(id: number): Promise<Result<Farmer>> {
    const farmer = await this.repos.farmers.findById(id);
    return farmer ? ok(farmer) : notFound('Produtor não encontrado.');
  }

  async create(input: FarmerInput): Promise<Result<Farmer>> {
    const unique = await checkProfileUnique(this.repos.farmers, input.email, input.cpf);
    if (!unique.ok) return unique;

    const farmer = await this.repos.farmers.create({ ...input, farms: [], photo_url: null, insertion_date: this.clock.now() });
    return ok(farmer);
  }

  // id e cpf não podem ser alterados (o parser já recusa).
  async update(id: number, changes: FarmerUpdate): Promise<Result<Farmer>> {
    const farmer = await this.repos.farmers.findById(id);
    if (!farmer) return notFound('Produtor não encontrado.');

    const unique = await checkProfileUnique(this.repos.farmers, changes.email, undefined, farmer.id);
    if (!unique.ok) return unique;

    if (changes.email !== undefined) farmer.email = changes.email;
    if (changes.name !== undefined) farmer.name = changes.name;
    if (changes.phone !== undefined) farmer.phone = changes.phone;
    await this.repos.farmers.update(farmer);

    return ok(farmer);
  }

  // Remove em cascata: candidaturas → serviços → fazendas → produtor (pagamentos ficam como histórico).
  // Bloqueado enquanto houver serviço em andamento.
  async delete(id: number): Promise<Result<null>> {
    const { farmers, farms, services, applications } = this.repos;
    const farmer = await farmers.findById(id);
    if (!farmer) return notFound('Produtor não encontrado.');

    const ownServices = await services.find({ farmer_id: farmer.id });
    if (ownServices.some((s) => s.status === SERVICE_STATUS.IN_PROGRESS)) {
      return conflict('Não é possível remover: há serviço em andamento. Conclua o pagamento antes.');
    }

    // TODO(db): numa transação, ou com ON DELETE CASCADE.
    for (const service of ownServices) {
      for (const application of await applications.find({ service_id: service.id })) {
        await applications.delete(application.id);
      }
      await services.delete(service.id);
    }
    for (const farm of await farms.find({ farmer_id: farmer.id })) {
      for (const photo of farm.photos) await this.images.delete(photo.id);
      await farms.delete(farm.id);
    }
    await releaseImage(this.images, farmer.photo_url);
    await farmers.delete(farmer.id);

    return ok(null);
  }
}
