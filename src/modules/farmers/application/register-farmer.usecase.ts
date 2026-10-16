import { type AccountRepository, type SessionUser, checkNewAccount, createAccount, toSession } from '#modules/accounts';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, ok } from '#shared/domain/result';
import type { FarmerRepository } from '../domain/farmer.repository';
import type { Farmer, FarmerInput } from '../farmer.contract';
import type { CreateFarmerProfileUseCase } from './create-farmer-profile.usecase';

export interface RegisterFarmerDeps {
  farmers: FarmerRepository;
  workers: WorkerRepository;
  accounts: AccountRepository;
  passwords: PasswordHasher;
  clock: Clock;
  createProfile: CreateFarmerProfileUseCase;
}

// O cadastro que chega aqui já aceitou os termos (o parser da rota exige `accept_terms: true`).
export type NewFarmer = Omit<FarmerInput, 'accept_terms'>;

// Cadastro: cria a conta com o perfil de produtor (guardando o aceite dos termos) e já devolve a sessão.
export class RegisterFarmerUseCase {
  constructor(private readonly deps: RegisterFarmerDeps) {}

  async execute(input: NewFarmer): Promise<Result<{ farmer: Farmer; user: SessionUser }>> {
    const free = await checkNewAccount(this.deps, input.email, input.cpf);
    if (!free.ok) return free;

    const { password, ...profile } = input;
    const farmer = await this.deps.createProfile.execute(profile);
    if (!farmer.ok) return farmer;
    const account = await createAccount(this.deps.accounts, this.deps.passwords, {
      email: input.email, password, role: 'farmer', profileId: farmer.value.id, termsAcceptedAt: this.deps.clock.now()
    });
    return ok({ farmer: farmer.value, user: toSession(account) });
  }
}
