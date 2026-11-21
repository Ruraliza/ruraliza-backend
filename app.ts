// Importação das dependências
import 'dotenv/config'; // Carrega as variáveis de ambiente do arquivo .env
import { randomBytes } from 'node:crypto';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { OpenAPIV3 } from 'openapi-types';
import swaggerUi from 'swagger-ui-express';
import { type InitialAdminSettings, databaseUrl, demoSeedEnabled, initialAdminSettings, isAllowedOrigin, serverPort, supabaseStorageSettings } from '#shared/config';
import { type Container, createContainer } from './src/container';
import type { ApiError } from '#shared/contracts/api';
import { createSupabaseFileStores, openPostgres, seedDemoOnce } from './src/postgres';
import { SEED_PASSWORD, seed } from './src/seed';
import { PDF_CONTENT_TYPE, RESUME_MAX_UPLOAD_BYTES } from '#shared/domain/documents';
import { IMAGE_MAX_UPLOAD_BYTES } from '#shared/domain/images';
import { buildOpenApiDocument } from './src/docs/openapi';
import { isRecord } from '#shared/infra/http/body';
import { PG_INVALID_VALUE_CODES, PG_UNIQUE_VIOLATION, asDatabase, pgErrorCode } from '#shared/infra/postgres/database';
import { checkSupabaseBucket } from '#shared/infra/supabase/supabase-file-store';
import { buildRouter } from '#shared/infra/http/route';
import type { Handler } from '#shared/infra/http/types';
import { createRouteGroups } from './src/routes';

export interface ApiOptions {
  // Modo desenvolvimento (npm run dev): o CORS aceita qualquer origem. A configuração do mapa
  // continua restrita às origens de CORS_ORIGINS (ver src/modules/platform/presentation/platform.routes.ts).
  devMode?: boolean;
}

export interface Api {
  app: Express;
  document: OpenAPIV3.Document;
}

// Monta a API sobre um container (repositórios + casos de uso). Cada chamada é independente,
// então testes podem criar APIs isoladas, e a persistência (memória ou PostgreSQL) vem no container.
export function createApi(container: Container = createContainer(), options: ApiOptions = {}): Api {
  const routeGroups = createRouteGroups(container);
  const document = buildOpenApiDocument(routeGroups);
  const app = express();

  // --- MIDDLEWARES GLOBAIS ---
  // CORS: só o frontend publicado (ou as origens de CORS_ORIGINS) pode chamar a API pelo navegador.
  // Em desenvolvimento, qualquer origem.
  // WWW-Authenticate fica visível ao frontend: é como ele distingue sessão vencida de senha errada.
  const exposedHeaders = ['WWW-Authenticate'];
  app.use(options.devMode
    ? cors({ exposedHeaders })
    : cors({ origin: (origin, callback) => callback(null, isAllowedOrigin(origin)), exposedHeaders }));
  // O corpo chega aos handlers como `unknown`; cada um valida o formato (ver src/shared/infra/http/body.ts).
  app.use(express.json());
  // Envio de fotos: o corpo é o próprio arquivo (Content-Type image/*), lido como bytes.
  app.use(express.raw({ type: 'image/*', limit: IMAGE_MAX_UPLOAD_BYTES }));
  // Envio de currículo: o corpo é o próprio PDF.
  app.use(express.raw({ type: PDF_CONTENT_TYPE, limit: RESUME_MAX_UPLOAD_BYTES }));

  // --- DOCUMENTAÇÃO (Swagger UI) ---
  // Gerada a partir das mesmas rotas montadas abaixo (src/routes, src/docs).
  const openApiJson: Handler<OpenAPIV3.Document> = (_req, res) => res.json(document);
  app.get('/api/docs/openapi.json', openApiJson);
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'Ruraliza API' }));

  // A raiz do servidor leva à documentação (fica fora do OpenAPI: não é uma operação da API).
  const rootToDocs: Handler<never> = (_req, res) => {
    res.redirect(302, '/api/docs');
  };
  app.get('/', rootToDocs);

  // --- ROTAS ---
  for (const group of routeGroups) {
    app.use(group.prefix || '/', buildRouter(group.routes));
  }

  // --- ROTA INEXISTENTE ---
  const notFound: Handler<never> = (req, res) => {
    return res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
  };
  app.use(notFound);

  // --- TRATAMENTO DE ERROS GLOBAL ---
  app.use(errorHandler);

  return { app, document };
}

// Erro do express.json() quando o corpo não é um JSON válido.
function isJsonParseError(error: unknown): boolean {
  return isRecord(error) && error['type'] === 'entity.parse.failed';
}

// Erro do express.raw() quando a foto ou o currículo passa do limite.
function isTooLargeError(error: unknown): boolean {
  return isRecord(error) && error['type'] === 'entity.too.large';
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

// Sempre responde { error } com o status HTTP correto. Erros de handlers async também chegam
// aqui (o Express 5 repassa promises rejeitadas).
// O Express reconhece o handler de erro pelos 4 parâmetros, por isso `_next` fica na assinatura.
function errorHandler(error: unknown, req: Request, res: Response<ApiError>, _next: NextFunction): void {
  if (isJsonParseError(error)) {
    res.status(400).json({ error: 'O corpo da requisição não é um JSON válido.' });
    return;
  }
  if (isTooLargeError(error)) {
    const message = req.is(PDF_CONTENT_TYPE)
      ? 'O currículo passa de 5 MB. Envie um PDF menor.'
      : 'A foto passa de 10 MB. Envie uma imagem menor.';
    res.status(413).json({ error: message });
    return;
  }
  // Rede de proteção do banco: os casos de uso conferem antes de gravar, mas duas requisições ao mesmo
  // tempo podem passar juntas pela conferência. Aí quem barra é a restrição UNIQUE, e a segunda recebe 409.
  const pgCode = pgErrorCode(error);
  if (pgCode === PG_UNIQUE_VIOLATION) {
    res.status(409).json({ error: 'Este registro já existe ou acabou de ser alterado. Atualize a página e tente de novo.' });
    return;
  }
  if (pgCode !== undefined && PG_INVALID_VALUE_CODES.includes(pgCode)) {
    res.status(400).json({ error: 'Os dados enviados têm um valor que não pode ser guardado (número grande demais ou caractere inválido).' });
    return;
  }
  console.error('Erro interno:', describeError(error));
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
}

// --- INICIALIZAÇÃO ---
export interface Boot {
  container: Container;
  // Onde os dados ficam: PostgreSQL com DATABASE_URL; sem ela, memória (somem a cada reinício).
  storage: 'postgres' | 'memory';
  // Onde os arquivos ficam: com o banco, num bucket do Supabase Storage (SUPABASE_*) ou no próprio PostgreSQL.
  files: 'supabase' | 'postgres' | 'memory';
  demoSeed: boolean;
  seededNow: boolean; // false no PostgreSQL quando os dados de teste já estavam no banco
  close: () => Promise<void>; // fecha as conexões com o banco
  initialAdmin: InitialAdminSettings | null;
  adminStatus: 'created' | 'exists' | null;
  generatedPassword: boolean; // true: sem ADMIN_*, a senha do administrador padrão foi sorteada agora
}

// Administrador padrão de produção quando o Render não tem ADMIN_EMAIL/ADMIN_PASSWORD. A senha é sorteada a
// cada subida e aparece uma vez no log do servidor: uma senha fixa no código (repositório público) deixaria
// qualquer pessoa entrar como administrador.
export const DEFAULT_ADMIN_EMAIL = 'admin@ruraliza.app';

// Monta o container do servidor. O seed cria as contas de teste com a senha pública do README e roda
// sempre, enquanto o app é só de demonstração (SEED_DEMO=false desliga). Sem o seed, a equipe entra pelo
// administrador de ADMIN_EMAIL/ADMIN_PASSWORD ou, sem eles, pelo administrador padrão.
// Também em --dev, o código de "esqueci a senha" sai no terminal, no lugar do e-mail (que ainda não existe);
// fora dele, a redefinição pública fica desligada.
// Com DATABASE_URL, os dados vão para o PostgreSQL: o esquema é atualizado na subida e o seed roda uma
// vez por banco. Sem ela, tudo fica em memória, como nos testes.
export async function bootContainer(devMode: boolean): Promise<Boot> {
  const url = databaseUrl();
  const postgres = url === null ? null : await openPostgres(url);
  const close = async (): Promise<void> => {
    await postgres?.pool.end();
  };
  try {
    // Chave errada, bucket inexistente ou público impedem a subida, como o banco fora do ar.
    const bucket = postgres ? supabaseStorageSettings() : null;
    if (bucket) await checkSupabaseBucket(bucket);
    const files = postgres && bucket ? createSupabaseFileStores(bucket, asDatabase(postgres.pool)) : undefined;
    const container = createContainer({ ...postgres?.storage, ...files, ...(devMode ? { deliverResetCode: printResetCode } : {}) });
    const demoSeed = devMode || demoSeedEnabled();
    let seededNow = false;
    if (demoSeed && postgres) {
      seededNow = await seedDemoOnce(postgres.pool, container.clock, container.passwords, files?.idDocuments);
    } else if (demoSeed) {
      await seed(container.repos, container.clock, container.passwords, container.idDocuments);
      seededNow = true;
    }
    const configured = initialAdminSettings();
    const generatedPassword = !configured && !demoSeed;
    const initialAdmin = configured ?? (generatedPassword ? { email: DEFAULT_ADMIN_EMAIL, password: randomBytes(12).toString('base64url'), name: 'Administrador' } : null);
    const adminStatus = initialAdmin && (await container.useCases.systemUsers.ensureInitialAdmin.execute(initialAdmin));
    return { container, storage: postgres ? 'postgres' : 'memory', files: files ? 'supabase' : postgres ? 'postgres' : 'memory', demoSeed, seededNow, close, initialAdmin, adminStatus, generatedPassword };
  } catch (error) {
    await close();
    throw error;
  }
}

// Só em --dev: o código é um segredo de uso único, e o e-mail fica fora do log.
function printResetCode(_email: string, code: string): void {
  console.log(`Esqueci a senha (só em --dev, no lugar do e-mail): código ${code}`);
}

// Só sobe o servidor quando executado diretamente (npm start / npm run dev).
async function main(): Promise<void> {
  const devMode = process.argv.includes('--dev');
  const { container, storage, files, demoSeed, seededNow, initialAdmin, adminStatus, generatedPassword } = await bootContainer(devMode);
  const { app } = createApi(container, { devMode });
  // Resumo semanal das vagas recomendadas (issue #23): confere a cada hora quem já pode receber.
  setInterval(() => {
    container.useCases.matching.alerts.sendWeeklyDigest().catch((error: unknown) => console.error('Falha no resumo semanal de vagas:', error));
  }, 60 * 60 * 1000).unref();
  // Aviso único do catálogo de prestadores para as contas de antes dele (o passo 004 marcou quem; sai uma vez só).
  container.useCases.matching.sendCatalogNotices().catch((error: unknown) => console.error('Falha no aviso do catálogo de prestadores:', error));

  const PORT = serverPort();
  app.listen(PORT, () => {
    console.log(`Servidor do Ruraliza rodando em http://localhost:${PORT}/api`);
    if (demoSeed && !seededNow) {
      console.log('Dados de TESTE: já estavam no banco, criados numa subida anterior (o que mudou desde então continua como está).');
    }
    if (demoSeed && seededNow) {
      console.log(`Dados de TESTE ${storage === 'postgres' ? 'gravados no banco' : 'carregados em memória'} (1 produtor, 2 fazendas, 2 trabalhadores, 7 vagas: 6 abertas e 1 vencida;`);
      console.log('mais 5 serviços concluídos com avaliações e 1 em andamento com conversa; 3 trilhas de estudo: 2 publicadas e 1 em rascunho).');
    }
    if (demoSeed) {
      console.log(`Perfis de teste: produtor@exemplo.com, trabalhador@exemplo.com, pedro@exemplo.com e ambos@exemplo.com, senha "${SEED_PASSWORD}".`);
      console.log(`Equipe (login em /api/auth/system/login): admin@exemplo.com e tutor@exemplo.com, senha "${SEED_PASSWORD}".`);
      if (!devMode) console.warn('Atenção: as contas de teste usam a senha pública do README. Defina SEED_DEMO=false quando houver dados de verdade.');
      if (!devMode && storage === 'postgres') console.warn('No banco, SEED_DEMO=false não apaga as contas de teste já gravadas: remova-as em /sistema ou comece com um banco novo.');
    }
    if (initialAdmin && generatedPassword && adminStatus === 'exists') {
      // Só com banco: o administrador padrão ficou gravado numa subida anterior, com a senha daquele log.
      console.warn(`Sem ADMIN_EMAIL/ADMIN_PASSWORD: o administrador padrão ${initialAdmin.email} já existe no banco, com a senha da subida em que foi criado.`);
      console.warn('Perdeu a senha? Defina ADMIN_EMAIL (um e-mail novo) e ADMIN_PASSWORD para criar outro administrador.');
    } else if (initialAdmin && generatedPassword) {
      // A única vez que a senha aparece: o log do servidor só é visto pela equipe (painel do Render).
      console.warn(`Sem ADMIN_EMAIL/ADMIN_PASSWORD: administrador padrão ${initialAdmin.email}, senha desta subida: ${initialAdmin.password}`);
      console.warn(storage === 'postgres'
        ? 'Ela fica gravada no banco e não aparece de novo. Para escolher a senha, defina ADMIN_EMAIL e ADMIN_PASSWORD no Render.'
        : 'A senha muda a cada reinício. Para uma senha fixa, defina ADMIN_EMAIL e ADMIN_PASSWORD no Render.');
    } else if (initialAdmin) {
      console.log(`Administrador do .env (ADMIN_EMAIL): ${initialAdmin.email} ${adminStatus === 'created' ? 'criado' : 'já existia'}.`);
    }
    console.log(storage === 'postgres'
      ? 'Dados no PostgreSQL (DATABASE_URL): continuam depois de reiniciar.'
      : 'Atenção: sem DATABASE_URL, os dados ficam em memória e somem quando o servidor reinicia.');
    if (files === 'supabase') console.log('Arquivos (fotos, currículos) no bucket do Supabase Storage (SUPABASE_BUCKET).');
    if (devMode) {
      console.log('Modo desenvolvimento: CORS liberado para qualquer origem (exceto /api/config/maps).');
      console.log('Esqueci a senha: o código sai neste terminal (fora do --dev, a redefinição fica desligada até o envio por e-mail existir).');
    }
  });
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('Falha ao iniciar o servidor:', describeError(error));
    process.exitCode = 1;
  });
}
