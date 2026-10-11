import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, ok, unauthorized } from '#shared/domain/result';
import type { SystemUser } from '../system-user.contract';
import { type SystemUserRepository, toSystemUser } from '../domain/system-user';
import { findSystemUserByEmail } from './find-system-user';

export interface SystemLoginDeps {
  systemUsers: SystemUserRepository;
  passwords: PasswordHasher;
}

// Login da equipe. Mesma mensagem para e-mail desconhecido e senha errada (como no login do app).
export class SystemLoginUseCase {
  constructor(private readonly deps: SystemLoginDeps) {}

  async execute({ email, password }: { email: string; password: string }): Promise<Result<SystemUser>> {
    const user = await findSystemUserByEmail(this.deps.systemUsers, email);
    if (!user || !(await this.deps.passwords.verify(password, user.password_hash))) {
      return unauthorized('E-mail ou senha incorretos.');
    }
    return ok(toSystemUser(user));
  }
}
