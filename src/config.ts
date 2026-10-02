// Configuração lida do ambiente (.env, carregado em app.ts; veja .env.example).
// Lida a cada chamada, para que testes possam trocar as variáveis sem reiniciar o processo.

export function serverPort(): string {
  return process.env['PORT'] || '3000';
}

export interface GoogleMapsSettings {
  apiKey: string;
  mapId: string;
}

// Chave e Map ID do Google Maps Platform. `apiKey` vazia = mapa desligado.
export function googleMapsSettings(): GoogleMapsSettings {
  return {
    apiKey: (process.env['GOOGLE_MAPS_API_KEY'] ?? '').trim(),
    mapId: (process.env['GOOGLE_MAPS_MAP_ID'] ?? '').trim() || 'DEMO_MAP_ID'
  };
}

// Origem do frontend publicado. A origem é só esquema + domínio (+ porta), sem caminho:
// https://ruraliza.github.io/ruraliza-frontend/ chega no cabeçalho Origin como https://ruraliza.github.io.
export const FRONTEND_ORIGIN = 'https://ruraliza.github.io';

// Origens que podem chamar a API pelo navegador (CORS) e receber a configuração do mapa.
// CORS_ORIGINS (separadas por vírgula) substitui o padrão, ex.: http://localhost:4200 no .env local.
export function allowedOrigins(): string[] {
  const fromEnv = (process.env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : [FRONTEND_ORIGIN];
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  return origin !== undefined && allowedOrigins().includes(origin);
}
