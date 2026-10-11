// Token de sessão entregue no login e enviado em `Authorization: Bearer <token>`.
// Diz só QUEM entrou (uma conta do app ou um usuário de sistema); perfis e cargo são relidos
// do repositório a cada requisição, então conta ou perfil removido perde o acesso na hora.
export type TokenSubject = { kind: 'account'; id: number } | { kind: 'system'; id: number };

// Validade do token: depois disso, é preciso entrar de novo.
export const SESSION_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export interface SessionTokens {
  issue(subject: TokenSubject): string;
  // null = token malformado, adulterado ou vencido.
  verify(token: string): TokenSubject | null;
}
