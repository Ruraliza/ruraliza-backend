import { fixedClock } from '#shared/testing/fixed-clock';
import type { SystemUsersModuleDeps } from '../system-users.module';
import type { SystemRole } from '../system-user.contract';
import type { SystemUserRecord } from '../domain/system-user';
import { createInMemorySystemUserRepository } from '../infra/in-memory-system-user.repository';

// Equipe em memória, com hash de senha falso.

export const NOW = '2026-01-01T00:00:00.000Z';

export function systemUsersTestbed(): SystemUsersModuleDeps {
  return {
    systemUsers: createInMemorySystemUserRepository(),
    clock: fixedClock(NOW),
    passwords: { hash: (p) => Promise.resolve(`hash(${p})`), verify: (p, h) => Promise.resolve(h === `hash(${p})`) }
  };
}

export function givenSystemUser(t: SystemUsersModuleDeps, email: string, role: SystemRole = 'tutor'): Promise<SystemUserRecord> {
  return t.systemUsers.create({ email, name: email, role, password_hash: 'hash(senha-forte)', insertion_date: NOW });
}
