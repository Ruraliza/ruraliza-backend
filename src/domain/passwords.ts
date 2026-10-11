// Validade do token de redefinição.
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Tokens de redefinição: aleatórios, e guardados só como resumo (digest).
export interface ResetTokens {
  create(): { token: string; digest: string };
  digest(token: string): string;
}
