import { googleMapsSettings, isAllowedOrigin, vapidSettings } from '#shared/config';
import type { HealthResponse, MapsConfig, PushConfig } from '../contracts';
import { TAGS, operation } from '../docs/operations';
import { PUBLIC_ROUTE } from '../http/access';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { Handler } from '#shared/infra/http/types';

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

// Chave pública VAPID (VAPID_PUBLIC_KEY no .env). É pública por definição: não precisa checar a origem.
const pushConfig: Handler<PushConfig> = (_req, res) => {
  const vapid = vapidSettings();
  if (!vapid) return res.status(503).json({ error: 'Notificações push não configuradas no servidor.' });
  return res.json({ public_key: vapid.publicKey });
};

// Montadas em /api (a raiz do servidor redireciona para a documentação, ver app.ts).
export const systemRoutes: readonly RouteDef[] = [
  route('get', '/health', health, operation({
    tag: TAGS.system,
    summary: 'Health check',
    success: { status: 200, description: 'O servidor está rodando.', schema: 'HealthResponse' }
  }), PUBLIC_ROUTE),

  route('get', '/config/maps', mapsConfig, operation({
    tag: TAGS.system,
    summary: 'Configuração do Google Maps',
    description: 'Chave e Map ID usados pelo frontend para carregar o mapa (definidos no .env do backend).',
    success: { status: 200, description: 'Chave e Map ID.', schema: 'MapsConfig' },
    errors: {
      403: 'Pedido sem o cabeçalho Origin do frontend (https://ruraliza.github.io ou CORS_ORIGINS).',
      503: 'GOOGLE_MAPS_API_KEY não definida no .env.'
    }
  }), PUBLIC_ROUTE),

  route('get', '/config/push', pushConfig, operation({
    tag: TAGS.system,
    summary: 'Configuração das notificações push',
    description: 'Chave pública VAPID para o `PushManager.subscribe()` do navegador.',
    success: { status: 200, description: 'Chave pública VAPID.', schema: 'PushConfig' },
    errors: { 503: 'VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não definida no .env.' }
  }), PUBLIC_ROUTE)
];
