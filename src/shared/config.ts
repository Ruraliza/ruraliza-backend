// Configuração lida do ambiente (.env, carregado em app.ts; veja .env.example).
// Lida a cada chamada, para que testes possam trocar as variáveis sem reiniciar o processo.
import { randomBytes } from 'node:crypto';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './domain/passwords';

export function serverPort(): string {
  return process.env['PORT'] || '3000';
}

// Endereço do PostgreSQL (postgres://usuario:senha@host:5432/banco). null = sem banco: os dados ficam em
// memória e somem a cada reinício (desenvolvimento rápido e testes).
export function databaseUrl(): string | null {
  return (process.env['DATABASE_URL'] ?? '').trim() || null;
}

export interface SupabaseStorageSettings {
  url: string;
  serviceKey: string;
  bucket: string;
}

// Bucket privado do Supabase Storage para os arquivos (fotos, currículos, fotos de documento). As três
// variáveis juntas ligam; null = os arquivos ficam no PostgreSQL. Só vale com DATABASE_URL.
// A chave de serviço ignora as regras de acesso do bucket: nunca sai do servidor.
export function supabaseStorageSettings(): SupabaseStorageSettings | null {
  const url = (process.env['SUPABASE_URL'] ?? '').trim().replace(/\/+$/, '');
  const serviceKey = (process.env['SUPABASE_SERVICE_KEY'] ?? '').trim();
  const bucket = (process.env['SUPABASE_BUCKET'] ?? '').trim();
  if (!url && !serviceKey && !bucket) return null;
  if (!url || !serviceKey || !bucket) throw new Error('Defina SUPABASE_URL, SUPABASE_SERVICE_KEY e SUPABASE_BUCKET juntas (ou nenhuma).');
  if (!/^https?:\/\//.test(url)) throw new Error('SUPABASE_URL precisa ser o endereço do projeto (https://<projeto>.supabase.co).');
  return { url, serviceKey, bucket };
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
// funciona, mas toda sessão cai quando o servidor reinicia. Com banco (DATABASE_URL), defina sempre.
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

// Endereço público do frontend, usado nos links que saem do app (ex.: mensagem de WhatsApp).
export function appUrl(): string {
  return ((process.env['APP_URL'] ?? '').trim() || 'https://ruraliza.github.io/ruraliza-frontend').replace(/\/+$/, '');
}

export interface WhatsAppSettings {
  apiUrl: string;
  apiKey: string;
  instance: string;
}

// Integração de WhatsApp (Evolution API v2). null = desligada: nada é enviado.
export function whatsAppSettings(): WhatsAppSettings | null {
  const apiUrl = (process.env['WHATSAPP_API_URL'] ?? '').trim().replace(/\/+$/, '');
  const apiKey = (process.env['WHATSAPP_API_KEY'] ?? '').trim();
  const instance = (process.env['WHATSAPP_INSTANCE'] ?? '').trim();
  return apiUrl && apiKey && instance ? { apiUrl, apiKey, instance } : null;
}

// Contas de teste (seed) também em produção, enquanto o app é só de demonstração e teste: as contas usam a
// senha pública do README (a tela de entrar só as mostra no build de desenvolvimento). SEED_DEMO=false desliga, e deve ficar desligado
// quando houver dados de verdade. Com banco (DATABASE_URL), o seed roda uma vez e as contas ficam gravadas:
// desligar depois não as apaga.
export function demoSeedEnabled(): boolean {
  return (process.env['SEED_DEMO'] ?? '').trim().toLowerCase() !== 'false';
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
