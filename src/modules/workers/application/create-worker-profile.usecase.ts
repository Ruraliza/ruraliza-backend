import { checkProfileUnique } from '#modules/accounts';
import type { Clock } from '#shared/domain/clock';
import { type Result, ok } from '#shared/domain/result';
import type { Worker } from '../worker.contract';
import type { WorkerRepository } from '../domain/worker.repository';

// Cadastro de trabalhador já validado (os textos opcionais chegam como null quando vazios).
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

export interface CreateWorkerProfileDeps {
  workers: WorkerRepository;
  clock: Clock;
}

// Só o perfil, sem conta: quem chama liga à conta (o cadastro, ou o segundo perfil de uma conta).
export class CreateWorkerProfileUseCase {
  constructor(private readonly deps: CreateWorkerProfileDeps) {}

  async execute(profile: NewWorkerProfile): Promise<Result<Worker>> {
    const unique = await checkProfileUnique(this.deps.workers, profile.email, profile.cpf);
    if (!unique.ok) return unique;
    return ok(await this.deps.workers.create({ ...profile, photo_url: null, resume_url: null, insertion_date: this.deps.clock.now() }));
  }
}
