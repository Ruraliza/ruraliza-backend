// Importação das dependências
import 'dotenv/config'; // Carrega as variáveis de ambiente do arquivo .env
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { ApiError, HealthResponse } from './src/contracts';
import { seed } from './src/data/seed';
import { isRecord } from './src/http/body';
import type { Handler } from './src/http/types';
import categoryRoutes from './src/routes/categoryRoutes';
import farmerRoutes from './src/routes/farmerRoutes';
import workerRoutes from './src/routes/workerRoutes';

const app = express();

// --- MIDDLEWARES GLOBAIS ---
// CORS permite que o frontend (localhost:4200) chame esta API.
app.use(cors());
// O corpo chega aos handlers como `unknown`; cada um valida o formato (ver src/http/body.ts).
app.use(express.json());

// --- ROTAS ---
app.use('/api/farmers', farmerRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/categories', categoryRoutes);

// Health check
const health: Handler<HealthResponse> = (_req, res) => {
  return res.json({ message: 'Bem-vindo à API do Ruraliza! O servidor está rodando.' });
};
app.get('/', health);

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
