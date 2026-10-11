// Configuração lida do ambiente (.env, carregado em app.ts; veja .env.example).
// Lida a cada chamada, para que testes possam trocar as variáveis sem reiniciar o processo.
import { randomBytes } from 'node:crypto';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './domain/passwords';

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

export interface VapidSettings {
  publicKey: string;
  privateKey: string;
  subject: string;
}

// Chaves VAPID das notificações push (gere com `npx web-push generate-vapid-keys`).
// null = push desligado: as inscrições são aceitas, mas nada é enviado.
export function vapidSettings(): VapidSettings | null {
  const publicKey = (process.env['VAPID_PUBLIC_KEY'] ?? '').trim();
  const privateKey = (process.env['VAPID_PRIVATE_KEY'] ?? '').trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: (process.env['VAPID_SUBJECT'] ?? '').trim() || 'mailto:contato@ruraliza.app' };
}

// Segredo que assina os tokens de sessão. Sem AUTH_TOKEN_SECRET, um aleatório por processo:
// funciona, mas toda sessão cai quando o servidor reinicia (como os dados em memória).
let generatedSecret: string | null = null;

export function authTokenSecret(): string {
  const fromEnv = (process.env['AUTH_TOKEN_SECRET'] ?? '').trim();
  if (fromEnv) return fromEnv;
  if (generatedSecret === null) {
    generatedSecret = randomBytes(32).toString('base64url');
    console.warn('AUTH_TOKEN_SECRET não definido: usando um segredo temporário (as sessões caem a cada reinício).');
  }
  return generatedSecret;
}

export interface InitialAdminSettings {
  email: string;
  password: string;
  name: string;
}

// Primeiro administrador, criado ao subir o servidor se ainda não existir. null = não definido.
export function initialAdminSettings(): InitialAdminSettings | null {
  const email = (process.env['ADMIN_EMAIL'] ?? '').trim().toLowerCase();
  const password = process.env['ADMIN_PASSWORD'] ?? '';
  if (!email || !password) return null;
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`ADMIN_PASSWORD precisa ter de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`);
  }
  return { email, password, name: (process.env['ADMIN_NAME'] ?? '').trim() || 'Administrador' };
}
