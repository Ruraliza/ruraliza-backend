// Importação das dependências
import 'dotenv/config'; // Carrega as variáveis de ambiente do arquivo .env
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { OpenAPIV3 } from 'openapi-types';
import swaggerUi from 'swagger-ui-express';
import { initialAdminSettings, isAllowedOrigin, serverPort } from '#shared/config';
import { type Container, createContainer } from './src/container';
import type { ApiError } from '#shared/contracts/api';
import { SEED_PASSWORD, seed } from './src/seed';
import { PDF_CONTENT_TYPE, RESUME_MAX_UPLOAD_BYTES } from '#shared/domain/documents';
import { IMAGE_MAX_UPLOAD_BYTES } from '#shared/domain/images';
import { buildOpenApiDocument } from './src/docs/openapi';
import { isRecord } from '#shared/infra/http/body';
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
// então testes podem criar APIs isoladas, e trocar a persistência é só passar outro container.
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
  console.error('Erro interno:', describeError(error));
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
}

// --- INICIALIZAÇÃO ---
// Só sobe o servidor (e o seed) quando executado diretamente (npm start / npm run dev).
async function main(): Promise<void> {
  const devMode = process.argv.includes('--dev');
  const container = createContainer();
  await seed(container.repos, container.clock, container.passwords, container.idDocuments);
  const initialAdmin = initialAdminSettings();
  const adminStatus = initialAdmin && (await container.useCases.systemUsers.ensureInitialAdmin.execute(initialAdmin));
  const { app } = createApi(container, { devMode });
  // Resumo semanal das vagas recomendadas (issue #23): confere a cada hora quem já pode receber.
  setInterval(() => {
    container.useCases.matching.alerts.sendWeeklyDigest().catch((error: unknown) => console.error('Falha no resumo semanal de vagas:', error));
  }, 60 * 60 * 1000).unref();

  const PORT = serverPort();
  app.listen(PORT, () => {
    console.log(`Servidor do Ruraliza rodando em http://localhost:${PORT}/api`);
    console.log('Dados de TESTE carregados em memória (1 produtor, 2 fazendas, 2 trabalhadores, 7 vagas: 6 abertas e 1 vencida;');
    console.log('mais 5 serviços concluídos com avaliações e 1 em andamento com conversa; 3 trilhas de estudo: 2 publicadas e 1 em rascunho).');
    console.log(`Perfis de teste: produtor@exemplo.com, trabalhador@exemplo.com, pedro@exemplo.com e ambos@exemplo.com, senha "${SEED_PASSWORD}".`);
    console.log(`Equipe (login em /api/auth/system/login): admin@exemplo.com e tutor@exemplo.com, senha "${SEED_PASSWORD}".`);
    if (initialAdmin) {
      console.log(`Administrador do .env (ADMIN_EMAIL): ${initialAdmin.email} ${adminStatus === 'created' ? 'criado' : 'já existia'}.`);
    }
    console.log('Atenção: todos os dados somem quando o servidor reinicia.');
    if (devMode) console.log('Modo desenvolvimento: CORS liberado para qualquer origem (exceto /api/config/maps).');
  });
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('Falha ao iniciar o servidor:', describeError(error));
    process.exitCode = 1;
  });
}
