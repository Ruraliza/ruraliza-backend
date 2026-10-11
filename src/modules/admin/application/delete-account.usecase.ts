import type { AccountRepository } from '#modules/accounts';
import type { FarmerUseCases } from '#modules/farmers';
import { SERVICE_STATUS, type ServiceRepository } from '#modules/services';
import type { WorkerUseCases } from '#modules/workers';
import { type Result, conflict, notFound, ok } from '#shared/domain/result';

export interface DeleteAccountDeps {
  accounts: AccountRepository;
  services: ServiceRepository;
  // Remover cada perfil usa as mesmas regras de quando o próprio usuário remove.
  farmerUseCases: Pick<FarmerUseCases, 'deleteFarmer'>;
  workerUseCases: Pick<WorkerUseCases, 'deleteWorker'>;
}

// Remove os dois perfis (com fazendas, serviços e candidaturas) e, com o último, a conta.
// Confere os bloqueios dos dois antes, para não remover só metade.
export class DeleteAccountUseCase {
  constructor(private readonly deps: DeleteAccountDeps) {}

  async execute({ accountId }: { accountId: number }): Promise<Result<null>> {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) return notFound('Conta não encontrada.');

    const { services } = this.deps;
    if (account.farmer_id !== null) {
      const own = await services.find({ farmer_id: account.farmer_id, status: SERVICE_STATUS.IN_PROGRESS });
      if (own.length > 0) return conflict('Não é possível remover: o produtor tem serviço em andamento. O pagamento precisa ser concluído antes.');
    }
    if (account.worker_id !== null) {
      const assigned = await services.find({ worker_id: account.worker_id, status: SERVICE_STATUS.IN_PROGRESS });
      if (assigned.length > 0) return conflict('Não é possível remover: o trabalhador tem serviço em andamento.');
    }

    // TODO(db): numa transação.
    if (account.farmer_id !== null) {
      const removed = await this.deps.farmerUseCases.deleteFarmer.execute({ farmerId: account.farmer_id });
      if (!removed.ok) return removed;
    }
    if (account.worker_id !== null) {
      const removed = await this.deps.workerUseCases.deleteWorker.execute({ workerId: account.worker_id });
      if (!removed.ok) return removed;
    }
    return ok(null);
  }
}
