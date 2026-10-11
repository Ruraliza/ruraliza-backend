import type { IncomingHttpHeaders } from 'node:http';
import { type Result, ok } from '../../domain/result';
import type { Principal, Query } from './types';

// Quem pode chamar cada rota. Toda rota declara um `Access` (ver route() em ./route.ts), que vira a
// checagem antes do handler e a seção de segurança da documentação. As políticas concretas
// (dono do recurso, cargo...) ficam em src/modules/auth/presentation/access.ts.
//
// - Sem token, ou token inválido/vencido: 401.
// - Token válido, mas de outro tipo de usuário, de outro dono, ou de um cargo sem a permissão: 403.
// - Recurso inexistente passa adiante: o handler responde 404 como sempre.

export interface AccessRequest {
  headers: IncomingHttpHeaders;
  params: unknown;
  body: unknown;
  query: Query;
}

export interface Access {
  audience: 'public' | 'account' | 'system';
  // Quem pode, em uma frase (vai para a documentação).
  rule: string;
  // Aceita o token também em `?access_token=` (só SSE: o EventSource do navegador não envia cabeçalhos).
  tokenInQuery: boolean;
  authorize(req: AccessRequest): Promise<Result<Principal | null>>;
}

export interface AccessOptions {
  tokenInQuery?: boolean;
}

// Rota aberta, sem token (login, cadastro, imagens, configuração...).
export const PUBLIC_ROUTE: Access = {
  audience: 'public',
  rule: 'Pública.',
  tokenInQuery: false,
  authorize: () => Promise.resolve(ok(null))
};
