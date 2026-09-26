const express = require('express');
const router = express.Router();
const FarmerController = require('../controllers/FarmerController');

// Listar todos os produtores
// GET /api/farmers
router.get('/', FarmerController.listFarmers);

// Cadastrar um novo produtor
// POST /api/farmers
router.post('/', FarmerController.createFarmer);

// Rota para solicitar um novo serviço (RF01)[cite: 3]
// POST /api/farmers/services
router.post('/services', FarmerController.requestService);

// Rota para analisar e aceitar/recusar um prestador (RF03)[cite: 3]
// PATCH /api/farmers/services/:id/analyze
router.patch('/services/:id/analyze', FarmerController.analyzeOffer);

// Rota para realizar e liberar o pagamento do serviço (RF04)[cite: 3]
// POST /api/farmers/services/:id/payment
router.post('/services/:id/payment', FarmerController.processPayment);

module.exports = router;