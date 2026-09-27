// Importação das dependências
require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env
const express = require('express');
const cors = require('cors');
const { seed } = require('./src/data/seed');

const app = express();

// --- MIDDLEWARES GLOBAIS ---
// CORS permite que o frontend (localhost:4200) chame esta API.
app.use(cors());
app.use(express.json());
// No Express 5, req.body fica undefined quando não há corpo; padroniza para {}.
app.use((req, res, next) => {
  req.body = req.body ?? {};
  next();
});

// --- ROTAS ---
const farmerRoutes = require('./src/routes/farmerRoutes');
const workerRoutes = require('./src/routes/workerRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');

app.use('/api/farmers', farmerRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/categories', categoryRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Bem-vindo à API do Ruraliza! O servidor está rodando.' });
});

// --- ROTA INEXISTENTE ---
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// --- TRATAMENTO DE ERROS GLOBAL ---
// Sempre responde { error } com o status HTTP correto.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'O corpo da requisição não é um JSON válido.' });
  }
  console.error('Erro interno:', err.stack);
  return res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
});

// --- INICIALIZAÇÃO ---
// Só sobe o servidor (e o seed) quando executado diretamente: `node app.js`.
if (require.main === module) {
  seed();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor do Ruraliza rodando em http://localhost:${PORT}/api`);
    console.log('Dados de TESTE carregados em memória (1 produtor, 2 fazendas, 1 trabalhador, 3 serviços).');
    console.log('Atenção: todos os dados somem quando o servidor reinicia.');
  });
}

module.exports = app;
