// Estado do servidor e configuração entregue ao frontend.

// GET /health
export interface HealthResponse {
  message: string;
}

// GET /config/maps: o que o frontend precisa para carregar o Google Maps.
// A chave vai para o navegador de qualquer forma; a proteção é a restrição por referrer no Google Cloud.
export interface MapsConfig {
  api_key: string;
  map_id: string;
}
