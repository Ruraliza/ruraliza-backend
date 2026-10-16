import { checkProfileUnique } from '#modules/accounts';
import type { Clock } from '#shared/domain/clock';
import { type Result, ok } from '#shared/domain/result';
import type { Farmer, FarmerInput } from '../farmer.contract';
import type { FarmerRepository } from '../domain/farmer.repository';

export type NewFarmerProfile = Omit<FarmerInput, 'password' | 'accept_terms'>;

export interface CreateFarmerProfileDeps {
  farmers: FarmerRepository;
  clock: Clock;
}

// Só o perfil, sem conta: quem chama liga à conta (o cadastro, ou o segundo perfil de uma conta).
export class CreateFarmerProfileUseCase {
  constructor(private readonly deps: CreateFarmerProfileDeps) {}

  async execute(profile: NewFarmerProfile): Promise<Result<Farmer>> {
    const unique = await checkProfileUnique(this.deps.farmers, profile.email, profile.cpf);
    if (!unique.ok) return unique;
    return ok(await this.deps.farmers.create({ ...profile, farms: [], photo_url: null, insertion_date: this.deps.clock.now() }));
  }
}
