import type { SystemUserInput } from '../system-user.contract';
import type { CreateSystemUserUseCase } from './create-system-user.usecase';

// Primeiro administrador (variáveis ADMIN_* do servidor). Não mexe num usuário que já existe.
export class EnsureInitialAdminUseCase {
  constructor(private readonly deps: { createSystemUser: CreateSystemUserUseCase }) {}

  async execute(input: Omit<SystemUserInput, 'role'>): Promise<'created' | 'exists'> {
    const created = await this.deps.createSystemUser.execute({ ...input, role: 'admin' });
    return created.ok ? 'created' : 'exists';
  }
}
