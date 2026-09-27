const express = require('express');
const router = express.Router();
const WorkerController = require('../controllers/WorkerController');

// Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

// --- SERVIÇOS ---

// GET /api/workers/services?category= - Vagas abertas (RF02)
router.get('/services', WorkerController.searchServices);

// GET /api/workers/services/:id - Detalhe da vaga
router.get('/services/:id', WorkerController.getServiceDetail);

// POST /api/workers/services/:id/apply - Candidatura (RF02)
router.post('/services/:id/apply', WorkerController.applyForService);

// --- TRABALHADORES ---

// GET /api/workers - Lista os trabalhadores
router.get('/', WorkerController.listWorkers);

// POST /api/workers - Cadastra um trabalhador
router.post('/', WorkerController.createWorker);

// GET /api/workers/:id - Perfil do trabalhador
router.get('/:id', WorkerController.getWorker);

// GET /api/workers/:id/applications - Candidaturas do trabalhador
router.get('/:id/applications', WorkerController.listWorkerApplications);

// GET /api/workers/:id/services - Serviços atribuídos ao trabalhador
router.get('/:id/services', WorkerController.listWorkerServices);

module.exports = router;
