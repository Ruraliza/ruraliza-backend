import type { UserRole } from '../contracts';

// Senha de um perfil. Fica fora da entidade do perfil (Farmer/Worker) para nunca sair numa resposta:
// é uma tabela à parte, ligada ao perfil por (role, user_id).
// TODO(db): tabela `credentials` com UNIQUE (role, user_id) e ON DELETE CASCADE a partir do perfil.
export interface Credential {
  id: number;
  role: UserRole;
  user_id: number;
  password_hash: string;
  // Redefinição pendente ("esqueci a senha"): só o resumo do token é guardado, nunca o token.
  reset_token_digest: string | null;
  reset_expires_at: string | null; // ISO 8601
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
