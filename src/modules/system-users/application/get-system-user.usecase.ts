import { type Result, notFound, ok } from '#shared/domain/result';
import type { SystemUser } from '../system-user.contract';
import { type SystemUserRepository, toSystemUser } from '../domain/system-user';
import { SYSTEM_USER_NOT_FOUND } from './find-system-user';

// Um usuário de sistema, sem o hash da senha (também a sessão de GET /auth/system/me, com o cargo atual).
export class GetSystemUserUseCase {
  constructor(private readonly deps: { systemUsers: SystemUserRepository }) {}

  async execute({ systemUserId }: { systemUserId: number }): Promise<Result<SystemUser>> {
    const user = await this.deps.systemUsers.findById(systemUserId);
    return user ? ok(toSystemUser(user)) : notFound(SYSTEM_USER_NOT_FOUND);
  }
}
