import type { Account, AccountRepository } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { FarmerUseCases } from '#modules/farmers';
import { SERVICE_STATUS, type ServiceRepository } from '#modules/services';
import { type Result, conflict, notFound, ok, requireFound } from '#shared/domain/result';
import { toPublicProfile } from '#shared/utils/profile';
import type { AdminUser } from '../contracts';
import type { WorkerRepository } from '../domain/repositories';
import type { WorkerUseCases } from './WorkerUseCases';

const ACCOUNT_NOT_FOUND = 'Conta não encontrada.';

// Gerenciamento das contas do app pelo administrador. Editar e remover um perfil usam as mesmas
// regras do próprio usuário (FarmerUseCases/WorkerUseCases); aqui ficam a lista e a remoção da conta inteira.
export class AdminUseCases {
  constructor(
    private readonly repos: {
      accounts: AccountRepository;
      farmers: FarmerRepository;
      workers: WorkerRepository;
      services: ServiceRepository;
    },
    private readonly profiles: { farmers: FarmerUseCases; workers: WorkerUseCases }
  ) {}

  // Todas as contas com os perfis (CPF mascarado), as mais novas primeiro.
  async listUsers(): Promise<AdminUser[]> {
    const accounts = await this.repos.accounts.find();
    const users = await Promise.all(accounts.map((account) => this.toAdminUser(account)));
    return users.reverse().map((user) => ({
      ...user,
      farmer: user.farmer && toPublicProfile(user.farmer),
      worker: user.worker && toPublicProfile(user.worker)
    }));
  }

  // Uma conta com os perfis completos.
  async getUser(accountId: number): Promise<Result<AdminUser>> {
    const account = await this.repos.accounts.findById(accountId);
    return account ? ok(await this.toAdminUser(account)) : notFound(ACCOUNT_NOT_FOUND);
  }

  // Remove os dois perfis (com fazendas, serviços e candidaturas) e, com o último, a conta.
  // Confere os bloqueios dos dois antes, para não remover só metade.
  async deleteUser(accountId: number): Promise<Result<null>> {
    const account = await this.repos.accounts.findById(accountId);
    if (!account) return notFound(ACCOUNT_NOT_FOUND);

    const { services } = this.repos;
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
      const removed = await this.profiles.farmers.deleteFarmer.execute({ farmerId: account.farmer_id });
      if (!removed.ok) return removed;
    }
    if (account.worker_id !== null) {
      const removed = await this.profiles.workers.delete(account.worker_id);
      if (!removed.ok) return removed;
    }
    return ok(null);
  }

  private async toAdminUser(account: Account): Promise<AdminUser> {
    const { farmers, workers } = this.repos;
    const farmer = account.farmer_id === null ? null : requireFound(await farmers.findById(account.farmer_id), `produtor ${account.farmer_id}`);
    const worker = account.worker_id === null ? null : requireFound(await workers.findById(account.worker_id), `trabalhador ${account.worker_id}`);
    return { account_id: account.id, email: account.email, farmer, worker };
  }
}
