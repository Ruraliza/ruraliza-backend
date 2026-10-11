import type { Farmer } from '#modules/farmers';
import type { Worker } from './worker';

// Usuários de sistema: a equipe do Ruraliza. Não se cadastram pela tela pública; quem cria é
// um administrador (ou o seed / as variáveis ADMIN_* do servidor). Entram por POST /auth/system/login.
// `admin`: gerencia os usuários do app e a equipe. `tutor`: vai gerenciar as trilhas de estudo.
export type SystemRole = 'admin' | 'tutor';

export interface SystemUser {
  id: number;
  email: string;
  name: string;
  role: SystemRole;
  insertion_date: string;
}

// POST /auth/system/login (o corpo é o mesmo LoginInput do app)
export interface SystemLoginResponse {
  message: string;
  user: SystemUser;
  token: string; // vai em `Authorization: Bearer <token>`
}

// POST /admin/system-users
export interface SystemUserInput {
  email: string;
  name: string;
  role: SystemRole;
  password: string; // 8 a 128 caracteres; nunca volta nas respostas
}

// PATCH /auth/system/me: o próprio usuário de sistema edita o perfil (o cargo só o administrador muda).
export type SystemUserUpdate = Partial<Pick<SystemUserInput, 'name' | 'email'>>;

// PATCH /admin/system-users/:id: o administrador edita outro usuário de sistema, inclusive o cargo
// (o próprio cargo não: a equipe não pode ficar sem administrador).
export interface AdminSystemUserUpdate extends SystemUserUpdate {
  role?: SystemRole;
}

export interface SystemUserResponse {
  message: string;
  system_user: SystemUser;
}

// GET /admin/users e /admin/users/:id: uma conta do app com os perfis que ela tem.
// O CPF vem mascarado na lista e completo no detalhe.
export interface AdminUser {
  account_id: number;
  email: string;
  farmer: Farmer | null;
  worker: Worker | null;
}
