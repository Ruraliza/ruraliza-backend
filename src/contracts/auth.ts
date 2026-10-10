// Acesso: login, redefinição de senha (esqueci a senha) e troca de senha com a conta aberta.
// O mesmo e-mail pode ter um perfil de produtor e outro de trabalhador, então o tipo de perfil vai junto.
export type UserRole = 'farmer' | 'worker';

// Quem entrou: o frontend guarda isto como usuário atual.
export interface SessionUser {
  role: UserRole;
  id: number;
}

// POST /auth/login
export interface LoginInput {
  role: UserRole;
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: SessionUser;
}

// POST /auth/password-reset (passo 1: informa o e-mail)
export interface PasswordResetRequestInput {
  role: UserRole;
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
