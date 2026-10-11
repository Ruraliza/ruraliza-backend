import type { Account } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { WorkerRepository } from '#modules/workers';
import { requireFound } from '#shared/domain/result';
import type { AdminUser } from '../admin.contract';

export interface AdminUserRepos {
  farmers: FarmerRepository;
  workers: WorkerRepository;
}

// A conta com os perfis que ela tem (completos).
export async function toAdminUser({ farmers, workers }: AdminUserRepos, account: Account): Promise<AdminUser> {
  const farmer = account.farmer_id === null ? null : requireFound(await farmers.findById(account.farmer_id), `produtor ${account.farmer_id}`);
  const worker = account.worker_id === null ? null : requireFound(await workers.findById(account.worker_id), `trabalhador ${account.worker_id}`);
  return { account_id: account.id, email: account.email, farmer, worker };
}
