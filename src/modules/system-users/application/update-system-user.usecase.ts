import { type Result, conflict, notFound, ok } from '#shared/domain/result';
import type { AdminSystemUserUpdate, SystemUser, SystemUserUpdate } from '../system-user.contract';
import { type SystemUserRepository, toSystemUser } from '../domain/system-user';
import { SYSTEM_EMAIL_TAKEN, SYSTEM_USER_NOT_FOUND, findSystemUserByEmail } from './find-system-user';

async function applyChanges(systemUsers: SystemUserRepository, id: number, changes: AdminSystemUserUpdate): Promise<Result<SystemUser>> {
  const user = await systemUsers.findById(id);
  if (!user) return notFound(SYSTEM_USER_NOT_FOUND);

  if (changes.email !== undefined && changes.email !== user.email && (await findSystemUserByEmail(systemUsers, changes.email))) {
    return conflict(SYSTEM_EMAIL_TAKEN);
  }
  if (changes.email !== undefined) user.email = changes.email;
  if (changes.name !== undefined) user.name = changes.name;
  if (changes.role !== undefined) user.role = changes.role;
  await systemUsers.update(user);
  return ok(toSystemUser(user));
}

// O próprio perfil: nome e e-mail (o cargo só um administrador muda).
export class UpdateOwnSystemUserUseCase {
  constructor(private readonly deps: { systemUsers: SystemUserRepository }) {}

  execute({ systemUserId, changes }: { systemUserId: number; changes: SystemUserUpdate }): Promise<Result<SystemUser>> {
    return applyChanges(this.deps.systemUsers, systemUserId, changes);
  }
}

export interface UpdateSystemUserByAdminInput {
  actorId: number;
  systemUserId: number;
  changes: AdminSystemUserUpdate;
}

// Edição pelo administrador (`actorId`): nome, e-mail e cargo. O próprio cargo não muda,
// para a equipe nunca ficar sem administrador.
export class UpdateSystemUserByAdminUseCase {
  constructor(private readonly deps: { systemUsers: SystemUserRepository }) {}

  async execute({ actorId, systemUserId, changes }: UpdateSystemUserByAdminInput): Promise<Result<SystemUser>> {
    if (systemUserId === actorId && changes.role !== undefined && changes.role !== 'admin') {
      return conflict('Você não pode alterar o próprio cargo. Peça a outro administrador.');
    }
    return applyChanges(this.deps.systemUsers, systemUserId, changes);
  }
}
