import type { SessionUser } from '#modules/accounts';

// Acesso: login, redefinição de senha (esqueci a senha) e troca de senha com a conta aberta.
// A conta e a sessão (SessionUser) ficam em src/modules/accounts.

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

// A mesma resposta com e sem conta para o e-mail. O código nunca volta aqui: chega só ao dono do
// e-mail (o envio ainda não existe; até lá, a redefinição pública fica desligada).
export interface PasswordResetRequestResponse {
  message: string;
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
