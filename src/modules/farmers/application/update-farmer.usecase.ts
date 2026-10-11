import { type AccountRepository, changeAccountEmail, checkProfileUnique } from '#modules/accounts';
import type { WorkerRepository } from '#modules/workers';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { FarmerRepository } from '../domain/farmer.repository';
import type { Farmer, FarmerUpdate } from '../farmer.contract';

export interface UpdateFarmerDeps {
  farmers: FarmerRepository;
  workers: WorkerRepository;
  accounts: AccountRepository;
}

export interface UpdateFarmerInput {
  farmerId: number;
  changes: FarmerUpdate;
}

// Edição do perfil. id e cpf não mudam (o parser já recusa); o e-mail novo vale para a conta e o outro perfil.
export class UpdateFarmerUseCase {
  constructor(private readonly deps: UpdateFarmerDeps) {}

  async execute({ farmerId, changes }: UpdateFarmerInput): Promise<Result<Farmer>> {
    const farmer = await this.deps.farmers.findById(farmerId);
    if (!farmer) return notFound('Produtor não encontrado.');

    const unique = await checkProfileUnique(this.deps.farmers, changes.email, undefined, farmer.id);
    if (!unique.ok) return unique;
    if (changes.email !== undefined) {
      const email = await changeAccountEmail(this.deps, 'farmer', farmer.id, changes.email);
      if (!email.ok) return email;
      farmer.email = changes.email;
    }

    if (changes.name !== undefined) farmer.name = changes.name;
    if (changes.phone !== undefined) farmer.phone = changes.phone;
    await this.deps.farmers.update(farmer);

    return ok(farmer);
  }
}
