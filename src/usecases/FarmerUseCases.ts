import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository } from '#modules/hiring';
import { SERVICE_STATUS, type ServiceRepository } from '#modules/services';
import { type ChangeFeed, workerApplications } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import type { ImageStore } from '#shared/domain/images';
import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import { toPublicProfile } from '#shared/utils/profile';
import type { Farmer, FarmerInput, FarmerUpdate, SessionUser } from '../contracts';
import type {
  AccountRepository,
  FarmerRepository,
  PushSubscriptionRepository,
  WorkerRepository
} from '../domain/repositories';
import { releaseImage } from './PhotoUseCases';
import { changeAccountEmail, checkNewAccount, createAccount, toSession, unlinkProfile } from './accounts';
import { checkProfileUnique } from './shared';

// Dados do perfil de produtor (a senha é da conta).
export type NewFarmerProfile = Omit<FarmerInput, 'password'>;

// Cadastro, edição e remoção de produtores.
export class FarmerUseCases {
  constructor(
    private readonly repos: {
      farmers: FarmerRepository;
      farms: FarmRepository;
      services: ServiceRepository;
      applications: ApplicationRepository;
      workers: WorkerRepository;
      accounts: AccountRepository;
      pushSubscriptions: PushSubscriptionRepository;
    },
    private readonly clock: Clock,
    private readonly images: ImageStore,
    private readonly hasher: PasswordHasher,
    private readonly changes: ChangeFeed
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

  // Cadastro: cria a conta com o perfil de produtor e já devolve a sessão.
  async create(input: FarmerInput): Promise<Result<{ farmer: Farmer; user: SessionUser }>> {
    const free = await checkNewAccount(this.repos, input.email, input.cpf);
    if (!free.ok) return free;

    const { password, ...profile } = input;
    const farmer = await this.createProfile(profile);
    if (!farmer.ok) return farmer;
    const account = await createAccount(this.repos.accounts, this.hasher, { email: input.email, password, role: 'farmer', profileId: farmer.value.id });
    return ok({ farmer: farmer.value, user: toSession(account) });
  }

  // Só o perfil, sem conta: quem chama liga à conta (cadastro ou segundo perfil, em AccountUseCases).
  async createProfile(profile: NewFarmerProfile): Promise<Result<Farmer>> {
    const unique = await checkProfileUnique(this.repos.farmers, profile.email, profile.cpf);
    if (!unique.ok) return unique;
    return ok(await this.repos.farmers.create({ ...profile, farms: [], photo_url: null, insertion_date: this.clock.now() }));
  }

  // id e cpf não podem ser alterados (o parser já recusa).
  async update(id: number, changes: FarmerUpdate): Promise<Result<Farmer>> {
    const farmer = await this.repos.farmers.findById(id);
    if (!farmer) return notFound('Produtor não encontrado.');

    const unique = await checkProfileUnique(this.repos.farmers, changes.email, undefined, farmer.id);
    if (!unique.ok) return unique;
    if (changes.email !== undefined) {
      const email = await changeAccountEmail(this.repos, 'farmer', farmer.id, changes.email);
      if (!email.ok) return email;
      farmer.email = changes.email;
    }

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
    const applicants = new Set<number>();
    for (const service of ownServices) {
      for (const application of await applications.find({ service_id: service.id })) {
        await applications.delete(application.id);
        applicants.add(application.worker_id);
      }
      await services.delete(service.id);
    }
    for (const farm of await farms.find({ farmer_id: farmer.id })) {
      for (const photo of farm.photos) await this.images.delete(photo.id);
      await farms.delete(farm.id);
    }
    await releaseImage(this.images, farmer.photo_url);
    await unlinkProfile(this.repos, 'farmer', farmer.id);
    await farmers.delete(farmer.id);
    // As candidaturas somem da tela "Candidaturas" de quem se candidatou.
    this.changes.publish([...applicants].map(workerApplications));

    return ok(null);
  }
}
