import type { SystemUser } from '../system-user.contract';
import { type SystemUserRepository, toSystemUser } from '../domain/system-user';

// A equipe (administradores e tutores).
export class ListSystemUsersUseCase {
  constructor(private readonly deps: { systemUsers: SystemUserRepository }) {}

  async execute(): Promise<SystemUser[]> {
    return (await this.deps.systemUsers.find()).map(toSystemUser);
  }
}
