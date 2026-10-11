import type { SystemUserRecord, SystemUserRepository } from '../domain/system-user';

export const SYSTEM_USER_NOT_FOUND = 'Usuário de sistema não encontrado.';
export const SYSTEM_EMAIL_TAKEN = 'Já existe um usuário de sistema com este e-mail.';

export async function findSystemUserByEmail(systemUsers: SystemUserRepository, email: string): Promise<SystemUserRecord | undefined> {
  const [user] = await systemUsers.find({ email });
  return user;
}
