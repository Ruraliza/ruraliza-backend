import { googleMapsSettings, isAllowedOrigin } from '../config';
import type { HealthResponse, MapsConfig } from '../contracts';
import { TAGS, operation } from '../docs/operations';
import { type RouteDef, route } from '../http/route';
import type { Handler } from '../http/types';

// Health check
const health: Handler<HealthResponse> = (_req, res) => {
  return res.json({ message: 'Bem-vindo à API do Ruraliza! O servidor está rodando.' });
};

// Chave e Map ID do Google Maps, vindos do .env (GOOGLE_MAPS_API_KEY / GOOGLE_MAPS_MAP_ID).
// Só responde a pedidos com Origin do frontend: o CORS sozinho não impede curl/Postman de ler a chave.
const mapsConfig: Handler<MapsConfig> = (req, res) => {
  if (!isAllowedOrigin(req.get('origin'))) {
    return res.status(403).json({ error: 'Origem não autorizada a obter a configuração do mapa.' });
  }
  const { apiKey, mapId } = googleMapsSettings();
  if (!apiKey) return res.status(503).json({ error: 'Google Maps não configurado no servidor.' });
  return res.json({ api_key: apiKey, map_id: mapId });
};

// Montadas em /api (a raiz do servidor redireciona para a documentação, ver app.ts).
export const systemRoutes: readonly RouteDef[] = [
  route('get', '/health', health, operation({
    tag: TAGS.system,
    summary: 'Health check',
    success: { status: 200, description: 'O servidor está rodando.', schema: 'HealthResponse' }
  })),

  route('get', '/config/maps', mapsConfig, operation({
    tag: TAGS.system,
    summary: 'Configuração do Google Maps',
    description: 'Chave e Map ID usados pelo frontend para carregar o mapa (definidos no .env do backend).',
    success: { status: 200, description: 'Chave e Map ID.', schema: 'MapsConfig' },
    errors: {
      403: 'Pedido sem o cabeçalho Origin do frontend (https://ruraliza.github.io ou CORS_ORIGINS).',
      503: 'GOOGLE_MAPS_API_KEY não definida no .env.'
    }
  }))
];
