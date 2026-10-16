import { type AccountRepository, type UserRole, findAccountOf } from '#modules/accounts';
import type { FarmerRepository } from '#modules/farmers';
import type { ApplicationRepository } from '#modules/hiring';
import type { PushNotifier } from '#modules/notifications';
import type { ServiceRepository } from '#modules/services';
import type { WorkerRepository } from '#modules/workers';
import type { Clock } from '#shared/domain/clock';
import { type ReportRecord, type ReportRepository, toReport } from '../domain/report';
import type { AdminReport, ReportTargetType } from '../report.contract';

export interface ReportDeps {
  reports: ReportRepository;
  farmers: FarmerRepository;
  workers: WorkerRepository;
  services: ServiceRepository;
  applications: ApplicationRepository;
  accounts: AccountRepository;
  clock: Clock;
  push: PushNotifier;
}

export const REMOVED_PROFILE = '(perfil removido)';
export const REMOVED_TARGET = '(removido)';

async function profileName({ farmers, workers }: ReportDeps, role: UserRole, id: number): Promise<string | undefined> {
  return (await (role === 'farmer' ? farmers.findById(id) : workers.findById(id)))?.name;
}

async function accountIdOf({ accounts }: ReportDeps, role: UserRole, id: number): Promise<number | null> {
  return (await findAccountOf(accounts, role, id))?.id ?? null;
}

// Nome do que foi denunciado e a conta responsável (a do produtor, no caso de uma vaga).
async function describeTarget(deps: ReportDeps, type: ReportTargetType, id: number): Promise<{ name: string; accountId: number | null }> {
  if (type === 'service') {
    const service = await deps.services.findById(id);
    return service
      ? { name: service.name, accountId: await accountIdOf(deps, 'farmer', service.farmer_id) }
      : { name: REMOVED_TARGET, accountId: null };
  }
  const name = await profileName(deps, type, id);
  return name === undefined ? { name: REMOVED_TARGET, accountId: null } : { name, accountId: await accountIdOf(deps, type, id) };
}

// A denúncia como a equipe vê: com os nomes e as contas, para abrir na administração.
export async function toAdminReport(deps: ReportDeps, record: ReportRecord): Promise<AdminReport> {
  const { reporter_role: role, reporter_id: profileId } = record;
  const target = await describeTarget(deps, record.target_type, record.target_id);
  const reporterName = await profileName(deps, role, profileId);
  return {
    ...toReport(record),
    reporter: {
      role,
      profile_id: profileId,
      name: reporterName ?? REMOVED_PROFILE,
      account_id: reporterName === undefined ? null : await accountIdOf(deps, role, profileId)
    },
    target_name: target.name,
    target_account_id: target.accountId,
    resolution_note: record.resolution_note,
    reviewed_at: record.reviewed_at
  };
}
