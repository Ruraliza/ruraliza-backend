import type { IncomingHttpHeaders } from 'node:http';
import type { Account, AccountRepository } from '#modules/accounts';
import type { ServiceRepository } from '#modules/services';
import { type SystemPermission, type SystemUserRepository, canDo } from '#modules/system-users';
import { type Result, forbidden, ok, unauthorized } from '#shared/domain/result';
import type { SessionTokens } from '#shared/domain/tokens';
import type { Principal, Query } from '#shared/infra/http/types';

// Quem pode chamar cada rota. Toda rota declara um `Access` (ver route() em ./route.ts), que vira a
// checagem antes do handler e a seção de segurança da documentação.
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

export const SIGN_IN_REQUIRED = 'Entre na sua conta para continuar.';
export const SESSION_EXPIRED = 'Sua sessão expirou. Entre novamente.';
const NOT_YOURS = 'Você não tem acesso a este recurso.';
const ACCOUNTS_ONLY = 'Esta ação é das contas de produtor e trabalhador.';
const STAFF_ONLY = 'Acesso restrito à equipe do Ruraliza.';
const ROLE_NOT_ALLOWED = 'Seu cargo não permite esta ação.';

type AccountCheck = (account: Account, req: AccessRequest) => Promise<Result<null>> | Result<null>;

function field(source: unknown, name: string): unknown {
  return typeof source === 'object' && source !== null ? (source as Record<string, unknown>)[name] : undefined;
}

// Id informado pelo cliente (URL, corpo ou query). Ausente = undefined (o handler acusa a falta).
function idFrom(source: unknown, name: string): number | undefined {
  const value = field(source, name);
  return value === undefined || value === null || value === '' ? undefined : Number(value);
}

function bearerToken(req: AccessRequest, tokenInQuery: boolean): string | undefined {
  const header = req.headers.authorization;
  if (header !== undefined) {
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : '';
  }
  if (tokenInQuery) {
    const token = req.query['access_token'];
    if (typeof token === 'string') return token;
  }
  return undefined;
}

// Rota aberta, sem token (login, cadastro, imagens, configuração...).
export const PUBLIC_ROUTE: Access = {
  audience: 'public',
  rule: 'Pública.',
  tokenInQuery: false,
  authorize: () => Promise.resolve(ok(null))
};

export interface AccessDeps {
  repos: { accounts: AccountRepository; systemUsers: SystemUserRepository; services: ServiceRepository };
  tokens: SessionTokens;
}

export interface AccessPolicies {
  ownAccount(param?: string): Access;
  ownFarmer(param?: string): Access;
  ownWorker(param?: string, options?: AccessOptions): Access;
  farmerOfService(param?: string, options?: AccessOptions): Access;
  farmerInBody(name?: string): Access;
  workerInBody(name?: string): Access;
  worker(query?: string): Access;
  system(permission: SystemPermission): Access;
  anySystemUser: Access;
}

export function createAccess({ repos, tokens }: AccessDeps): AccessPolicies {
  async function authenticate(req: AccessRequest, tokenInQuery: boolean): Promise<Result<Principal>> {
    const token = bearerToken(req, tokenInQuery);
    if (token === undefined) return unauthorized(SIGN_IN_REQUIRED);

    const subject = token ? tokens.verify(token) : null;
    if (subject === null) return unauthorized(SESSION_EXPIRED);
    if (subject.kind === 'account') {
      const account = await repos.accounts.findById(subject.id);
      return account ? ok({ kind: 'account', account }) : unauthorized(SESSION_EXPIRED);
    }
    const user = await repos.systemUsers.findById(subject.id);
    return user ? ok({ kind: 'system', user }) : unauthorized(SESSION_EXPIRED);
  }

  // Rota de uma conta do app; `check` confere se o recurso é dela.
  function account(rule: string, check: AccountCheck, options: AccessOptions = {}): Access {
    const tokenInQuery = options.tokenInQuery ?? false;
    return {
      audience: 'account',
      rule,
      tokenInQuery,
      async authorize(req) {
        const principal = await authenticate(req, tokenInQuery);
        if (!principal.ok) return principal;
        if (principal.value.kind !== 'account') return forbidden(ACCOUNTS_ONLY);

        const allowed = await check(principal.value.account, req);
        return allowed.ok ? principal : allowed;
      }
    };
  }

  // Id ausente ou que nem é número passa: o handler responde 400/404 como sempre (não há recurso a proteger).
  const owns = (profileId: number | null, requested: number | undefined): Result<null> =>
    profileId !== null && (requested === undefined || Number.isNaN(requested) || requested === profileId) ? ok(null) : forbidden(NOT_YOURS);

  return {
    // A própria conta (`:param` é o account_id).
    ownAccount(param = 'id'): Access {
      return account('A própria conta.', (acc, req) => (acc.id === idFrom(req.params, param) ? ok(null) : forbidden(NOT_YOURS)));
    },

    // O próprio perfil de produtor (`:param` é o id do produtor).
    ownFarmer(param = 'id'): Access {
      return account('O próprio produtor.', (acc, req) => owns(acc.farmer_id, idFrom(req.params, param)));
    },

    // O próprio perfil de trabalhador (`:param` é o id do trabalhador).
    ownWorker(param = 'id', options: AccessOptions = {}): Access {
      return account('O próprio trabalhador.', (acc, req) => owns(acc.worker_id, idFrom(req.params, param)), options);
    },

    // O produtor dono do serviço `:param`.
    farmerOfService(param = 'id', options: AccessOptions = {}): Access {
      return account(
        'O produtor dono do serviço.',
        async (acc, req) => {
          if (acc.farmer_id === null) return forbidden(NOT_YOURS);
          const service = await repos.services.findById(idFrom(req.params, param) ?? NaN);
          return !service || service.farmer_id === acc.farmer_id ? ok(null) : forbidden(NOT_YOURS);
        },
        options
      );
    },

    // Produtor agindo por si: o `farmer_id` do corpo precisa ser o dele.
    farmerInBody(name = 'farmer_id'): Access {
      return account(`Produtor; \`${name}\` precisa ser o dele.`, (acc, req) => owns(acc.farmer_id, idFrom(req.body, name)));
    },

    // Trabalhador agindo por si: o `worker_id` do corpo precisa ser o dele.
    workerInBody(name = 'worker_id'): Access {
      return account(`Trabalhador; \`${name}\` precisa ser o dele.`, (acc, req) => owns(acc.worker_id, idFrom(req.body, name)));
    },

    // Qualquer conta com perfil de trabalhador; `?worker_id=`, se enviado, precisa ser o dele.
    worker(query = 'worker_id'): Access {
      return account(`Trabalhador; \`${query}\`, se enviado, precisa ser o dele.`, (acc, req) => owns(acc.worker_id, idFrom(req.query, query)));
    },

    // Usuário de sistema cujo cargo tem a permissão.
    system(permission: SystemPermission): Access {
      return {
        audience: 'system',
        rule: `Usuário de sistema com a permissão \`${permission}\`.`,
        tokenInQuery: false,
        async authorize(req) {
          const principal = await authenticate(req, false);
          if (!principal.ok) return principal;
          if (principal.value.kind !== 'system') return forbidden(STAFF_ONLY);
          return canDo(principal.value.user.role, permission) ? principal : forbidden(ROLE_NOT_ALLOWED);
        }
      };
    },

    // Qualquer usuário de sistema (ex.: a própria sessão).
    anySystemUser: {
      audience: 'system',
      rule: 'Qualquer usuário de sistema.',
      tokenInQuery: false,
      async authorize(req) {
        const principal = await authenticate(req, false);
        if (!principal.ok) return principal;
        return principal.value.kind === 'system' ? principal : forbidden(STAFF_ONLY);
      }
    } satisfies Access
  };
}
