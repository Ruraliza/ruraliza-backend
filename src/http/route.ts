import { Router } from 'express';
import type { OpenAPIV3 } from 'openapi-types';
import type { Handler } from './types';

export type HttpMethod = 'get' | 'post' | 'patch' | 'delete';

// Rota da API: o handler e a documentação OpenAPI andam juntos, então não há rota sem doc.
// `register` fecha sobre o handler tipado (cada rota tem seus próprios Params/Resposta).
export interface RouteDef {
  method: HttpMethod;
  path: string; // no formato do Express, ex.: '/:id/farms'
  doc: OpenAPIV3.OperationObject;
  register: (router: Router) => void;
}

export function route<Res, Params>(
  method: HttpMethod,
  path: string,
  handler: Handler<Res, Params>,
  doc: OpenAPIV3.OperationObject
): RouteDef {
  // operationId vem do nome do handler (ex.: listFarmers), usado por geradores de cliente.
  if (!handler.name) {
    throw new Error(`O handler de ${method.toUpperCase()} ${path} precisa ter nome (use uma const nomeada).`);
  }
  return {
    method,
    path,
    doc: { operationId: handler.name, ...doc },
    register: (router) => {
      switch (method) {
        case 'get':
          router.get(path, handler);
          break;
        case 'post':
          router.post(path, handler);
          break;
        case 'patch':
          router.patch(path, handler);
          break;
        case 'delete':
          router.delete(path, handler);
          break;
      }
    }
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
