// Importação das dependências
import 'dotenv/config'; // Carrega as variáveis de ambiente do arquivo .env
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { OpenAPIV3 } from 'openapi-types';
import swaggerUi from 'swagger-ui-express';
import type { ApiError } from './src/contracts';
import { seed } from './src/data/seed';
import { openApiDocument } from './src/docs/openapi';
import { isRecord } from './src/http/body';
import { buildRouter } from './src/http/route';
import type { Handler } from './src/http/types';
import { routeGroups } from './src/routes';

const app = express();

// --- MIDDLEWARES GLOBAIS ---
// CORS permite que o frontend (localhost:4200) chame esta API.
app.use(cors());
// O corpo chega aos handlers como `unknown`; cada um valida o formato (ver src/http/body.ts).
app.use(express.json());

// --- DOCUMENTAÇÃO (Swagger UI) ---
// Gerada a partir das mesmas rotas montadas abaixo (src/routes, src/docs).
const openApiJson: Handler<OpenAPIV3.Document> = (_req, res) => res.json(openApiDocument);
app.get('/api/docs/openapi.json', openApiJson);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'Ruraliza API' }));

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
// Sempre responde { error } com o status HTTP correto.

// Erro do express.json() quando o corpo não é um JSON válido.
function isJsonParseError(error: unknown): boolean {
  return isRecord(error) && error['type'] === 'entity.parse.failed';
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

// O Express reconhece o handler de erro pelos 4 parâmetros, por isso `_next` fica na assinatura.
function errorHandler(error: unknown, _req: Request, res: Response<ApiError>, _next: NextFunction): void {
  if (isJsonParseError(error)) {
    res.status(400).json({ error: 'O corpo da requisição não é um JSON válido.' });
    return;
  }
  console.error('Erro interno:', describeError(error));
  res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
}
app.use(errorHandler);

// --- INICIALIZAÇÃO ---
// Só sobe o servidor (e o seed) quando executado diretamente (npm start / npm run dev).
if (require.main === module) {
  seed();
  const PORT = process.env['PORT'] || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor do Ruraliza rodando em http://localhost:${PORT}/api`);
    console.log('Dados de TESTE carregados em memória (1 produtor, 2 fazendas, 1 trabalhador, 3 serviços).');
    console.log('Atenção: todos os dados somem quando o servidor reinicia.');
  });
}

export default app;
