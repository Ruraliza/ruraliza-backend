// Importação das dependências
import 'dotenv/config'; // Carrega as variáveis de ambiente do arquivo .env
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { OpenAPIV3 } from 'openapi-types';
import swaggerUi from 'swagger-ui-express';
import { type Container, createContainer } from './src/container';
import type { ApiError } from './src/contracts';
import { seed } from './src/data/seed';
import { IMAGE_MAX_UPLOAD_BYTES } from './src/domain/images';
import { buildOpenApiDocument } from './src/docs/openapi';
import { isRecord } from './src/http/body';
import { buildRouter } from './src/http/route';
import type { Handler } from './src/http/types';
import { createRouteGroups } from './src/routes';

export interface Api {
  app: Express;
  document: OpenAPIV3.Document;
}

// Monta a API sobre um container (repositórios + casos de uso). Cada chamada é independente,
// então testes podem criar APIs isoladas, e trocar a persistência é só passar outro container.
export function createApi(container: Container = createContainer()): Api {
  const routeGroups = createRouteGroups(container.useCases);
  const document = buildOpenApiDocument(routeGroups);
  const app = express();

  // --- MIDDLEWARES GLOBAIS ---
  // CORS permite que o frontend (localhost:4200) chame esta API.
  app.use(cors());
  // O corpo chega aos handlers como `unknown`; cada um valida o formato (ver src/http/parsers.ts).
  app.use(express.json());
  // Envio de fotos: o corpo é o próprio arquivo (Content-Type image/*), lido como bytes.
  app.use(express.raw({ type: 'image/*', limit: IMAGE_MAX_UPLOAD_BYTES }));

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

// Erro do express.raw() quando a foto passa do limite.
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
function errorHandler(error: unknown, _req: Request, res: Response<ApiError>, _next: NextFunction): void {
  if (isJsonParseError(error)) {
    res.status(400).json({ error: 'O corpo da requisição não é um JSON válido.' });
    return;
  }
  if (isTooLargeError(error)) {
    res.status(413).json({ error: 'A foto passa de 10 MB. Envie uma imagem menor.' });
    return;
  }
  console.error('Erro interno:', describeError(error));
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
}

// --- INICIALIZAÇÃO ---
// Só sobe o servidor (e o seed) quando executado diretamente (npm start / npm run dev).
async function main(): Promise<void> {
  const container = createContainer();
  await seed(container.repos, container.clock);
  const { app } = createApi(container);

  const PORT = process.env['PORT'] || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor do Ruraliza rodando em http://localhost:${PORT}/api`);
    console.log('Dados de TESTE carregados em memória (1 produtor, 2 fazendas, 1 trabalhador, 7 serviços: 6 vagas abertas e 1 vencida).');
    console.log('Atenção: todos os dados somem quando o servidor reinicia.');
  });
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('Falha ao iniciar o servidor:', describeError(error));
    process.exitCode = 1;
  });
}
