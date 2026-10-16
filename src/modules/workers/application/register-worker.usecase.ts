import { type AccountRepository, type SessionUser, checkNewAccount, createAccount, toSession } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { Clock } from '#shared/domain/clock';
import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, ok } from '#shared/domain/result';
import type { Worker } from '../worker.contract';
import type { WorkerRepository } from '../domain/worker.repository';
import type { CreateWorkerProfileUseCase, NewWorker } from './create-worker-profile.usecase';

export interface RegisterWorkerDeps {
  workers: WorkerRepository;
  farmers: FarmerRepository;
  accounts: AccountRepository;
  passwords: PasswordHasher;
  clock: Clock;
  createProfile: CreateWorkerProfileUseCase;
}

// Cadastro: cria a conta com o perfil de trabalhador (guardando o aceite dos termos, que o parser da rota
// exige) e já devolve a sessão.
export class RegisterWorkerUseCase {
  constructor(private readonly deps: RegisterWorkerDeps) {}

  async execute(input: NewWorker): Promise<Result<{ worker: Worker; user: SessionUser }>> {
    const free = await checkNewAccount(this.deps, input.email, input.cpf);
    if (!free.ok) return free;

    const { password, ...profile } = input;
    const worker = await this.deps.createProfile.execute(profile);
    if (!worker.ok) return worker;
    const account = await createAccount(this.deps.accounts, this.deps.passwords, {
      email: input.email, password, role: 'worker', profileId: worker.value.id, termsAcceptedAt: this.deps.clock.now()
    });
    return ok({ worker: worker.value, user: toSession(account) });
  }
}
