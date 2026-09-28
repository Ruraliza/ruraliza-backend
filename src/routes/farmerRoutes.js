const express = require('express');
const router = express.Router();
const FarmerController = require('../controllers/FarmerController');

// Atenção à ordem: rotas '/services/...' vêm antes de '/:id'.

// --- SERVIÇOS ---

// POST /api/farmers/services - Solicita um novo serviço (RF01)
router.post('/services', FarmerController.requestService);

// GET /api/farmers/services/:id - Serviço com a fazenda
router.get('/services/:id', FarmerController.getService);

// PATCH /api/farmers/services/:id - Edita um serviço Pending
router.patch('/services/:id', FarmerController.updateService);

// PATCH /api/farmers/services/:id/cancel - Cancela um serviço Pending
router.patch('/services/:id/cancel', FarmerController.cancelService);

// GET /api/farmers/services/:id/applications - Candidaturas do serviço
router.get('/services/:id/applications', FarmerController.listServiceApplications);

// PATCH /api/farmers/services/:id/analyze - Aceita/recusa uma candidatura (RF03)
router.patch('/services/:id/analyze', FarmerController.analyzeOffer);

// POST /api/farmers/services/:id/payment - Libera o pagamento (RF04)
router.post('/services/:id/payment', FarmerController.processPayment);

// --- PRODUTORES ---

// GET /api/farmers - Lista os produtores
router.get('/', FarmerController.listFarmers);

// POST /api/farmers - Cadastra um produtor
router.post('/', FarmerController.createFarmer);

// GET /api/farmers/:id - Perfil do produtor
router.get('/:id', FarmerController.getFarmer);

// PATCH /api/farmers/:id - Edita o produtor (id e cpf não podem ser alterados)
router.patch('/:id', FarmerController.updateFarmer);

// DELETE /api/farmers/:id - Remove o produtor
router.delete('/:id', FarmerController.deleteFarmer);

// GET /api/farmers/:id/farms - Fazendas do produtor
router.get('/:id/farms', FarmerController.listFarms);

// POST /api/farmers/:id/farms - Cadastra uma fazenda
router.post('/:id/farms', FarmerController.createFarm);

// GET /api/farmers/:id/services?status= - Serviços do produtor
router.get('/:id/services', FarmerController.listFarmerServices);

module.exports = router;
