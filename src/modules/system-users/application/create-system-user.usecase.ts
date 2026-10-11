import type { Clock } from '#shared/domain/clock';
import type { PasswordHasher } from '#shared/domain/passwords';
import { type Result, conflict, ok } from '#shared/domain/result';
import type { SystemUser, SystemUserInput } from '../system-user.contract';
import { type SystemUserRepository, toSystemUser } from '../domain/system-user';
import { SYSTEM_EMAIL_TAKEN, findSystemUserByEmail } from './find-system-user';

export interface CreateSystemUserDeps {
  systemUsers: SystemUserRepository;
  clock: Clock;
  passwords: PasswordHasher;
}

// Cadastro feito por um administrador. Independente das contas do app: o mesmo e-mail pode ter
// conta no app e usuário de sistema.
export class CreateSystemUserUseCase {
  constructor(private readonly deps: CreateSystemUserDeps) {}

  async execute(input: SystemUserInput): Promise<Result<SystemUser>> {
    if (await findSystemUserByEmail(this.deps.systemUsers, input.email)) return conflict(SYSTEM_EMAIL_TAKEN);

    const user = await this.deps.systemUsers.create({
      email: input.email,
      name: input.name,
      role: input.role,
      password_hash: await this.deps.passwords.hash(input.password),
      insertion_date: this.deps.clock.now()
    });
    return ok(toSystemUser(user));
  }
}
