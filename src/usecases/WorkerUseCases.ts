import type { ApplicationWithService, OpenService, Worker, WorkerUpdate } from '../contracts';
import { SERVICE_STATUS } from '../constants/status';
import type { Clock } from '../domain/clock';
import type { ImageStore } from '../domain/images';
import type { ApplicationRepository, FarmRepository, ServiceRepository, WorkerRepository } from '../domain/repositories';
import { type Result, conflict, notFound, ok, requireFound } from '../domain/result';
import { toPublicProfile } from '../utils/profile';
import { releaseImage } from './PhotoUseCases';
import { checkProfileUnique, toOpenService } from './shared';

// Dados de cadastro já validados (textos opcionais vazios viram null).
export interface NewWorker {
  email: string;
  name: string;
  phone: string;
  cpf: string;
  bio: string | null;
  certificates: string | null;
  courses: string | null;
  experience: string | null;
}

// Cadastro, edição, remoção e acompanhamento do trabalhador.
export class WorkerUseCases {
  constructor(
    private readonly repos: {
      workers: WorkerRepository;
      services: ServiceRepository;
      applications: ApplicationRepository;
      farms: FarmRepository;
    },
    private readonly clock: Clock,
    private readonly images: ImageStore
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

  async create(input: NewWorker): Promise<Result<Worker>> {
    const unique = await checkProfileUnique(this.repos.workers, input.email, input.cpf);
    if (!unique.ok) return unique;

    const worker = await this.repos.workers.create({ ...input, photo_url: null, insertion_date: this.clock.now() });
    return ok(worker);
  }

  // id e cpf não podem ser alterados (o parser já recusa).
  async update(id: number, changes: WorkerUpdate): Promise<Result<Worker>> {
    const worker = await this.repos.workers.findById(id);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const unique = await checkProfileUnique(this.repos.workers, changes.email, undefined, worker.id);
    if (!unique.ok) return unique;

    if (changes.email !== undefined) worker.email = changes.email;
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
    for (const application of await applications.find({ worker_id: worker.id })) {
      await applications.delete(application.id);
    }
    await releaseImage(this.images, worker.photo_url);
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

  // Serviços em que foi aceito (em andamento ou concluídos).
  async listServices(workerId: number): Promise<Result<OpenService[]>> {
    const worker = await this.repos.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const assigned = await this.repos.services.find({ worker_id: worker.id });
    return ok(await Promise.all(assigned.map((s) => toOpenService(this.repos.farms, s, worker.id))));
  }
}
