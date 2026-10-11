import { type AccountRepository, changeAccountEmail, checkProfileUnique } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { Worker, WorkerUpdate } from '../worker.contract';
import type { WorkerRepository } from '../domain/worker.repository';

export interface UpdateWorkerDeps {
  workers: WorkerRepository;
  farmers: FarmerRepository;
  accounts: AccountRepository;
}

export interface UpdateWorkerInput {
  workerId: number;
  changes: WorkerUpdate;
}

// Edição do perfil. id e cpf não mudam (o parser já recusa); o e-mail novo vale para a conta e o outro perfil.
export class UpdateWorkerUseCase {
  constructor(private readonly deps: UpdateWorkerDeps) {}

  async execute({ workerId, changes }: UpdateWorkerInput): Promise<Result<Worker>> {
    const worker = await this.deps.workers.findById(workerId);
    if (!worker) return notFound('Trabalhador não encontrado.');

    const unique = await checkProfileUnique(this.deps.workers, changes.email, undefined, worker.id);
    if (!unique.ok) return unique;
    if (changes.email !== undefined) {
      const email = await changeAccountEmail(this.deps, 'worker', worker.id, changes.email);
      if (!email.ok) return email;
      worker.email = changes.email;
    }

    if (changes.name !== undefined) worker.name = changes.name;
    if (changes.bio !== undefined) worker.bio = changes.bio;
    if (changes.certificates !== undefined) worker.certificates = changes.certificates;
    if (changes.courses !== undefined) worker.courses = changes.courses;
    if (changes.experience !== undefined) worker.experience = changes.experience;
    if (changes.phone !== undefined) worker.phone = changes.phone;
    await this.deps.workers.update(worker);

    return ok(worker);
  }
}
