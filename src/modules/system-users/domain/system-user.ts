import type { Repository } from '#shared/domain/repository';
import type { SystemRole, SystemUser } from '../system-user.contract';

// Usuário de sistema como fica guardado: com o hash da senha, que nunca sai numa resposta.
// TODO(db): tabela `system_users` com UNIQUE (email).
export interface SystemUserRecord extends SystemUser {
  password_hash: string;
}

// O que cada cargo pode fazer. As rotas pedem uma permissão, não um cargo: um cargo novo
// (ou uma permissão nova para o tutor) muda só este mapa.
// `tracks:manage`: criar trilhas e editar as de que é tutor. `tracks:oversee`: ver, criar, editar e
// descontinuar qualquer trilha (supervisão do administrador). `content:manage`: central de ajuda e
// patrocínios. `moderation:manage`: denúncias e verificação de perfis.
export type SystemPermission =
  | 'users:manage'
  | 'system-users:manage'
  | 'tracks:manage'
  | 'tracks:oversee'
  | 'content:manage'
  | 'moderation:manage';

export const SYSTEM_PERMISSIONS: Record<SystemRole, readonly SystemPermission[]> = {
  admin: ['users:manage', 'system-users:manage', 'tracks:oversee', 'content:manage', 'moderation:manage'],
  tutor: ['tracks:manage']
};

export const SYSTEM_ROLES: readonly SystemRole[] = ['admin', 'tutor'];

export const SYSTEM_ROLE_LABEL: Record<SystemRole, string> = { admin: 'Administrador', tutor: 'Tutor' };

export function canDo(role: SystemRole, permission: SystemPermission): boolean {
  return SYSTEM_PERMISSIONS[role].includes(permission);
}

// Sem o hash da senha.
export function toSystemUser(user: SystemUserRecord): SystemUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role, insertion_date: user.insertion_date };
}

// TODO(db): restrição UNIQUE (email).
export type SystemUserRepository = Repository<SystemUserRecord, 'email'>;
