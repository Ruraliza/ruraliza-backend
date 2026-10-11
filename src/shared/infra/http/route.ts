import { Router } from 'express';
import type { OpenAPIV3 } from 'openapi-types';
import type { Access } from '../../../http/access';
import { sendFailure } from './respond';
import type { Handler } from './types';

export type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

// Rota da API: o handler, quem pode chamá-lo e a documentação OpenAPI andam juntos, então não há
// rota sem doc nem sem decisão de acesso. `register` fecha sobre o handler tipado (cada rota tem
// seus próprios Params/Resposta).
export interface RouteDef {
  method: HttpMethod;
  path: string; // no formato do Express, ex.: '/:id/farms'
  doc: OpenAPIV3.OperationObject;
  register: (router: Router) => void;
}

// Esquema de segurança da documentação (Authorization: Bearer <token>).
export const BEARER_AUTH = 'bearerAuth';

// Cabeçalho WWW-Authenticate dos 401 de sessão. O frontend lê (CORS expõe) para saber que precisa entrar de novo.
export const SESSION_CHALLENGE = 'Bearer realm="ruraliza"';

export function route<Res, Params>(
  method: HttpMethod,
  path: string,
  handler: Handler<Res, Params>,
  doc: OpenAPIV3.OperationObject,
  access: Access
): RouteDef {
  // operationId vem do nome do handler (ex.: listFarmers), usado por geradores de cliente.
  if (!handler.name) {
    throw new Error(`O handler de ${method.toUpperCase()} ${path} precisa ter nome (use uma const nomeada).`);
  }

  // Confere o token (e o dono do recurso) antes do handler; quem entrou fica em res.locals.principal.
  const guarded: Handler<Res, Params> = async (req, res, next) => {
    const allowed = await access.authorize(req);
    if (!allowed.ok) {
      // RFC 6750: marca o 401 de sessão (sem token ou token inválido), diferente do 401 de senha errada.
      if (allowed.kind === 'unauthorized') res.setHeader('WWW-Authenticate', SESSION_CHALLENGE);
      sendFailure(res, allowed);
      return;
    }
    if (allowed.value) res.locals.principal = allowed.value;
    await handler(req, res, next);
  };

  return {
    method,
    path,
    doc: withAccessDoc({ operationId: handler.name, ...doc }, access),
    register: (router) => {
      switch (method) {
        case 'get':
          router.get(path, guarded);
          break;
        case 'post':
          router.post(path, guarded);
          break;
        case 'patch':
          router.patch(path, guarded);
          break;
        case 'delete':
          router.delete(path, guarded);
          break;
      }
    }
  };
}

const UNAUTHORIZED_DOC = 'Sem token, ou token inválido ou vencido (entre de novo). Vem com o cabeçalho `WWW-Authenticate: Bearer`.';
const FORBIDDEN_DOC = {
  account: 'O token é de outra conta (o recurso não é seu) ou de um usuário de sistema.',
  system: 'O token não é de usuário de sistema, ou o cargo não tem a permissão.'
} as const;

// Quem pode chamar, `security` e as respostas 401/403 vêm do `access`, não de cada rota.
function withAccessDoc(doc: OpenAPIV3.OperationObject, access: Access): OpenAPIV3.OperationObject {
  if (access.audience === 'public') return { ...doc, security: [] };

  const responses: OpenAPIV3.ResponsesObject = { ...doc.responses };
  addError(responses, '401', UNAUTHORIZED_DOC);
  addError(responses, '403', FORBIDDEN_DOC[access.audience]);

  const description = [doc.description, `**Acesso:** ${access.rule}`].filter(Boolean).join('\n\n');
  const parameters = access.tokenInQuery
    ? [
        ...(doc.parameters ?? []),
        {
          name: 'access_token',
          in: 'query',
          required: false,
          description: 'O token de sessão, para o `EventSource` do navegador (que não envia o cabeçalho Authorization).',
          schema: { type: 'string' }
        } satisfies OpenAPIV3.ParameterObject
      ]
    : doc.parameters;

  return {
    ...doc,
    description,
    ...(parameters === undefined ? {} : { parameters }),
    security: [{ [BEARER_AUTH]: [] }],
    responses
  };
}

function addError(responses: OpenAPIV3.ResponsesObject, status: '401' | '403', description: string): void {
  const current = responses[status];
  const previous = current !== undefined && 'description' in current ? `${current.description}\n\n` : '';
  responses[status] = {
    description: `${previous}${description}`,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
  };
}

// Grupo de rotas montado sob um prefixo (ex.: '/api/farmers').
export interface RouteGroup {
  prefix: string;
  routes: readonly RouteDef[];
}

export function buildRouter(routes: readonly RouteDef[]): Router {
  const router = Router();
  for (const r of routes) r.register(router);
  return router;
}

// '/api/farmers' + '/:id/farms/:farmId' -> '/api/farmers/{id}/farms/{farmId}'
export function toOpenApiPath(prefix: string, path: string): string {
  const full = path === '/' ? prefix || '/' : `${prefix}${path}`;
  return full.replace(/:([A-Za-z_]\w*)/g, '{$1}');
}
