import type { HealthResponse } from '../contracts';
import { TAGS, operation } from '../docs/operations';
import { type RouteDef, route } from '../http/route';
import type { Handler } from '../http/types';

// Health check
const health: Handler<HealthResponse> = (_req, res) => {
  return res.json({ message: 'Bem-vindo à API do Ruraliza! O servidor está rodando.' });
};

// Montadas na raiz do servidor.
export const systemRoutes: readonly RouteDef[] = [
  route('get', '/', health, operation({
    tag: TAGS.system,
    summary: 'Health check',
    success: { status: 200, description: 'O servidor está rodando.', schema: 'HealthResponse' }
  }))
];
