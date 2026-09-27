const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/CategoryController');

// GET /api/categories
router.get('/', CategoryController.listCategories);

module.exports = router;
