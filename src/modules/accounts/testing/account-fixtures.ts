import { createInMemoryFarmerRepository } from '#modules/farmers';
import type { Farmer } from '#modules/farmers';
import { createInMemoryPushSubscriptionRepository } from '#modules/notifications';
import { createInMemoryWorkerRepository } from '#modules/workers';
import type { Worker } from '#modules/workers';
import { ok } from '#shared/domain/result';
import type { AccountsModuleDeps } from '../accounts.module';
import type { Account } from '../domain/account';
import type { NewProfileData } from '../domain/profile-factory';
import { createInMemoryAccountRepository } from '../infra/in-memory-account.repository';

// Dependências da conta em memória, com uma ProfileFactory falsa que cria o perfil direto no
// repositório e grava o que recebeu.

export const NOW = '2026-01-01T00:00:00.000Z';

export interface AccountsTestbed extends AccountsModuleDeps {
  created: { role: string; data: NewProfileData }[];
  pushSubscriptions: ReturnType<typeof createInMemoryPushSubscriptionRepository>;
}

export function accountsTestbed(): AccountsTestbed {
  const farmers = createInMemoryFarmerRepository();
  const workers = createInMemoryWorkerRepository();
  const created: AccountsTestbed['created'] = [];
  return {
    accounts: createInMemoryAccountRepository(),
    farmers,
    workers,
    pushSubscriptions: createInMemoryPushSubscriptionRepository(),
    created,
    profiles: {
      create: async (role, data) => {
        created.push({ role, data });
        const { bio, certificates, courses, experience, ...base } = data;
        const profile = role === 'farmer'
          ? await farmers.create({ ...base, farms: [], photo_url: null, insertion_date: NOW })
          : await workers.create({ ...base, bio, certificates, courses, experience, photo_url: null, resume_url: null, insertion_date: NOW });
        return ok({ id: profile.id });
      }
    }
  };
}

export function givenFarmer(t: AccountsTestbed, email = 'ana@exemplo.com', cpf = '52998224725'): Promise<Farmer> {
  return t.farmers.create({ email, name: 'Ana', phone: '1', cpf, farms: [], photo_url: null, insertion_date: NOW });
}

export function givenWorker(t: AccountsTestbed, email = 'ana@exemplo.com', cpf = '52998224725'): Promise<Worker> {
  return t.workers.create({
    email, name: 'Ana', phone: '1', cpf, bio: null, certificates: null, courses: null, experience: null,
    photo_url: null, resume_url: null, insertion_date: NOW
  });
}

export function givenAccount(t: AccountsTestbed, changes: Partial<Account> = {}): Promise<Account> {
  return t.accounts.create({
    email: 'ana@exemplo.com', password_hash: 'hash', reset_token_digest: null, reset_expires_at: null,
    farmer_id: null, worker_id: null, last_role: 'farmer', ...changes
  });
}
