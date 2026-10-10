import type { UserRole } from '../contracts';

// Conta de acesso: um e-mail e uma senha, ligados a até dois perfis (produtor e trabalhador).
// Fica fora das entidades de perfil (Farmer/Worker) para a senha nunca sair numa resposta.
// TODO(db): tabela `accounts` com UNIQUE (email), UNIQUE (farmer_id), UNIQUE (worker_id),
// FKs para os perfis com ON DELETE SET NULL e CHECK de pelo menos um perfil.
export interface Account {
  id: number;
  email: string; // o mesmo dos perfis ligados
  password_hash: string;
  // Redefinição pendente ("esqueci a senha"): só o resumo do token é guardado, nunca o token.
  reset_token_digest: string | null;
  reset_expires_at: string | null; // ISO 8601
  farmer_id: number | null;
  worker_id: number | null;
  last_role: UserRole; // painel aberto por último: é o que abre no próximo login
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Validade do token de redefinição.
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Hash lento e com sal (ex.: scrypt). `verify` compara em tempo constante.
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

// Tokens de redefinição: aleatórios, e guardados só como resumo (digest).
export interface ResetTokens {
  create(): { token: string; digest: string };
  digest(token: string): string;
}
