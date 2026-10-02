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
