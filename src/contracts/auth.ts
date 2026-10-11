// Acesso: login, redefinição de senha (esqueci a senha) e troca de senha com a conta aberta.
// Uma conta (e-mail + senha) por pessoa, com até dois perfis: produtor e trabalhador.
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

// POST /auth/login
export interface LoginInput {
  email: string;
  password: string;
}

// `token` vai em `Authorization: Bearer <token>` nas rotas que exigem a conta aberta.
export interface LoginResponse {
  message: string;
  user: SessionUser;
  token: string;
}

// POST /auth/password-reset (passo 1: informa o e-mail)
export interface PasswordResetRequestInput {
  email: string;
}

// Simulação: o envio do código por e-mail ainda não existe, então o token volta na resposta.
// Quando o e-mail existir, `reset_token` sai daqui e chega só na caixa de entrada.
export interface PasswordResetRequestResponse {
  message: string;
  reset_token: string;
}

// POST /auth/password-reset/confirm (passo 2: cria a nova senha)
export interface PasswordResetInput {
  token: string;
  password: string;
}

// PATCH /farmers/:id/password e /workers/:id/password (com a conta aberta, sem código por e-mail)
export interface PasswordChangeInput {
  current_password: string;
  new_password: string;
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
