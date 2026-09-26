const express = require('express');
const router = express.Router();
const WorkerController = require('../controllers/WorkerController');

// Rota para procurar serviços disponíveis (RF02)[cite: 3]
// GET /api/workers/services
// Aceita Query Params (ex: /api/workers/services?category=Colheita)
router.get('/services', WorkerController.searchServices);

// Rota para se candidatar a um serviço específico (RF02)[cite: 3]
// POST /api/workers/services/:id/apply
router.post('/services/:id/apply', WorkerController.applyForService);

module.exports = router;