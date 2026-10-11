// Conta: um e-mail e uma senha por pessoa, com até dois perfis (produtor e trabalhador).
export type UserRole = 'farmer' | 'worker';

// Quem entrou: o frontend guarda isto como usuário atual.
// `role`/`id` são o perfil ativo (o painel aberto); `profiles` diz quais perfis a conta tem.
export interface SessionUser {
  account_id: number;
  role: UserRole;
  id: number;
  profiles: AccountProfiles;
}

export interface AccountProfiles {
  farmer: number | null;
  worker: number | null;
}

// Resposta das rotas que mudam a sessão (cadastro, novo perfil, troca de painel).
export interface SessionResponse {
  message: string;
  user: SessionUser;
}

// POST /accounts/:id/profiles (cria o outro perfil na mesma conta: e-mail e senha são os da conta)
export interface ProfileCreateInput {
  role: UserRole;
  name: string;
  phone: string;
  cpf: string;
  // Só para o perfil de trabalhador (ignorados no de produtor).
  bio?: string | null;
  certificates?: string | null;
  courses?: string | null;
  experience?: string | null;
}

// PATCH /accounts/:id/active-role (troca o painel aberto)
export interface ActiveRoleInput {
  role: UserRole;
}
