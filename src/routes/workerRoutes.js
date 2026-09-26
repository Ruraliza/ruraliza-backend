const express = require('express');
const router = express.Router();
const WorkerController = require('../controllers/WorkerController');

// --- ROTAS DE GERENCIAMENTO DE TRABALHADOR ---

// Listar todos os trabalhadores
// GET /api/workers
router.get('/', WorkerController.listWorkers);

// Cadastrar um novo trabalhador
// POST /api/workers
router.post('/', WorkerController.createWorker);

// --- ROTAS DE SERVIÇOS ---

// Rota para procurar serviços disponíveis (RF02)[cite: 3]
// GET /api/workers/services
router.get('/services', WorkerController.searchServices);

// Rota para se candidatar a um serviço específico (RF02)[cite: 3]
// POST /api/workers/services/:id/apply
router.post('/services/:id/apply', WorkerController.applyForService);

module.exports = router;