// Importação das dependências
require('dotenv').config(); // Carrega as variáveis de ambiente do arquivo .env
const express = require('express');
const cors = require('cors');

// Inicialização do aplicativo Express
const app = express();

// --- MIDDLEWARES GLOBAIS ---
// O CORS é fundamental aqui, pois permite que o seu aplicativo mobile 
// ou frontend web consiga fazer requisições para esta API.
app.use(cors());

// Permite que o servidor entenda requisições com o corpo em formato JSON
// (Essencial para receber os dados de cadastro, solicitações de serviço, etc.)
app.use(express.json()); 


// --- IMPORTAÇÃO E CONFIGURAÇÃO DAS ROTAS ---
const farmerRoutes = require('./src/routes/farmerRoutes');
const workerRoutes = require('./src/routes/workerRoutes');
// O sistemaRoutes deixaremos para implementar depois, quando focarmos nos relatórios.

// Toda rota que começa com '/api/farmers' será direcionada para farmerRoutes
app.use('/api/farmers', farmerRoutes);

// Toda rota que começa com '/api/workers' será direcionada para workerRoutes
app.use('/api/workers', workerRoutes);


// --- ROTA DE TESTE (Health Check) ---
// Útil para verificar se o servidor está no ar e respondendo
app.get('/', (req, res) => {
  res.json({ 
    status: 'success',
    message: 'Bem-vindo à API do Ruraliza! O servidor está rodando perfeitamente.' 
  });
});


// --- TRATAMENTO DE ERROS GLOBAL ---
// Captura erros inesperados para que o servidor não "quebre" silenciosamente
app.use((err, req, res, next) => {
  console.error('Erro interno:', err.stack);
  res.status(500).json({ 
    status: 'error',
    message: 'Ocorreu um erro interno no servidor.' 
  });
});


// --- INICIALIZAÇÃO DO SERVIDOR ---
// Utiliza a porta definida no .env ou a porta 3000 por padrão
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor do Ruraliza rodando na porta ${PORT}`);
});

// Exportamos o app caso seja necessário para testes automatizados no futuro
module.exports = app;