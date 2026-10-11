import type { FarmRepository } from '#modules/farms';
import type { ApplicationRepository } from '#modules/hiring';
import { SERVICE_STATUS, type ServiceRepository, toOpenService } from '#modules/services';
import { type ChangeFeed, type ChangeListener, serviceApplications, workerApplications } from '#shared/domain/changes';
import type { Clock } from '#shared/domain/clock';
import type { DocumentStore } from '#shared/domain/documents';
import type { ImageStore } from '#shared/domain/images';
import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, conflict, notFound, ok, requireFound } from '#shared/domain/result';
import { toPublicProfile } from '#shared/utils/profile';
import type { ApplicationWithService, OpenService, SessionUser, Worker, WorkerUpdate } from '../contracts';
import type {
  AccountRepository,
  FarmerRepository,
  PushSubscriptionRepository,
  WorkerRepository
} from '../domain/repositories';
import { releaseImage } from './PhotoUseCases';
import { releaseDocument } from './ResumeUseCases';
import { changeAccountEmail, checkNewAccount, createAccount, toSession, unlinkProfile } from './accounts';
import { checkProfileUnique } from './shared';

// Dados de cadastro já validados (textos opcionais vazios viram null).
export interface NewWorker {
  email: string;
  name: string;
  phone: string;
  cpf: string;
  password: string;
  bio: string | null;
  certificates: string | null;
  courses: string | null;
  experience: string | null;
}

// Dados do perfil de trabalhador (a senha é da conta).
export type NewWorkerProfile = Omit<NewWorker, 'password'>;

// Cadastro, edição, remoção e acompanhamento do trabalhador.
export class WorkerUseCases {
  constructor(
    private readonly repos: {
      workers: WorkerRepository;
      services: ServiceRepository;
      applications: ApplicationRepository;
      farms: FarmRepository;
      farmers: FarmerRepository;
      accounts: AccountRepository;
      pushSubscriptions: PushSubscriptionRepository;
    },
    private readonly clock: Clock,
    private readonly files: { images: ImageStore; documents: DocumentStore },
    private readonly hasher: PasswordHasher,
    private readonly changes: ChangeFeed
  ) {}

  // Lista com CPF mascarado.
  async list(): Promise<Worker[]> {
    return (await this.repos.workers.find()).map(toPublicProfile);
  }

  // Perfil completo (CPF sem máscara).
  async get(id: number): Promise<Result<Worker>> {
    const worker = await this.repos.workers.findById(id);
    return worker ? ok(worker) : notFound('Trabalhador não encontrado.');
  }

  // Cadastro: cria a conta com o perfil de trabalhador e já devolve a sessão.
  async create(input: NewWorker): Promise<Result<{ worker: Worker; user: SessionUser }>> {
    const free = await checkNewAccount(this.repos, input.email, input.cpf);
    if (!free.ok) return free;

    const { password, ...profile } = input;
    const worker = await this.createProfile(profile);
    if (!worker.ok) return worker;
    const account = await createAccount(this.repos.accounts, this.hasher, { email: input.email, password, role: 'worker', profileId: worker.value.id });
    return ok({ worker: worker.value, user: toSession(account) });
  }

  // Só o perfil, sem conta: quem chama liga à conta (cadastro ou segundo perfil, em AccountUseCases).
  async createProfile(profile: NewWorkerProfile): Promise<Result<Worker>> {
    const unique = await checkProfileUnique(this.repos.workers, profile.email, profile.cpf);
    if (!unique.ok) return unique;
    return ok(await this.repos.workers.create({ ...profile, photo_url: null, resume_url: null, insertion_date: this.clock.now() }));
  }

  // id e cpf não podem ser alterados (o parser já recusa).
  async update(id: number, changes: WorkerUpdate): Promise<Result<Worker>> {
    const worker = await this.repos.workers.findById(id);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const unique = await checkProfileUnique(this.repos.workers, changes.email, undefined, worker.id);
    if (!unique.ok) return unique;
    if (changes.email !== undefined) {
      const email = await changeAccountEmail(this.repos, 'worker', worker.id, changes.email);
      if (!email.ok) return email;
      worker.email = changes.email;
    }

    if (changes.name !== undefined) worker.name = changes.name;
    if (changes.bio !== undefined) worker.bio = changes.bio;
    if (changes.certificates !== undefined) worker.certificates = changes.certificates;
    if (changes.courses !== undefined) worker.courses = changes.courses;
    if (changes.experience !== undefined) worker.experience = changes.experience;
    if (changes.phone !== undefined) worker.phone = changes.phone;
    await this.repos.workers.update(worker);

    return ok(worker);
  }

  // As candidaturas embutem o perfil do trabalhador, então saem junto com ele.
  // Bloqueado enquanto houver serviço em andamento atribuído a ele.
  async delete(id: number): Promise<Result<null>> {
    const { workers, services, applications } = this.repos;
    const worker = await workers.findById(id);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const inProgress = await services.find({ worker_id: worker.id, status: SERVICE_STATUS.IN_PROGRESS });
    if (inProgress.length > 0) {
      return conflict('Não é possível remover: há serviço em andamento atribuído a este trabalhador.');
    }

    // TODO(db): numa transação, ou com ON DELETE CASCADE.
    const own = await applications.find({ worker_id: worker.id });
    for (const application of own) {
      await applications.delete(application.id);
    }
    // Some das listas de candidatos dos serviços em que se candidatou.
    this.changes.publish(own.map((a) => serviceApplications(a.service_id)));
    await releaseImage(this.files.images, worker.photo_url);
    await releaseDocument(this.files.documents, worker.resume_url);
    await unlinkProfile(this.repos, 'worker', worker.id);
    await workers.delete(worker.id);

    return ok(null);
  }

  // Candidaturas com o serviço embutido.
  async listApplications(workerId: number): Promise<Result<ApplicationWithService[]>> {
    const { workers, services, applications, farms } = this.repos;
    const worker = await workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const own = await applications.find({ worker_id: worker.id });
    const result = await Promise.all(
      own.map(async (a): Promise<ApplicationWithService> => {
        const service = requireFound(await services.findById(a.service_id), `serviço da candidatura ${a.id}`);
        return { ...a, service: await toOpenService(farms, service, worker.id) };
      })
    );
    return ok(result);
  }

  // Acompanha as candidaturas do trabalhador; devolve a função que para de acompanhar.
  async watchApplications(workerId: number, listener: ChangeListener): Promise<Result<() => void>> {
    const worker = await this.repos.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');
    return ok(this.changes.subscribe(workerApplications(worker.id), listener));
  }

  // Serviços em que foi aceito (em andamento ou concluídos).
  async listServices(workerId: number): Promise<Result<OpenService[]>> {
    const worker = await this.repos.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const assigned = await this.repos.services.find({ worker_id: worker.id });
    return ok(await Promise.all(assigned.map((s) => toOpenService(this.repos.farms, s, worker.id))));
  }
}
