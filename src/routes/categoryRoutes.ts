import { Router } from 'express';
import * as CategoryController from '../controllers/CategoryController';

const router = Router();

// GET /api/categories
router.get('/', CategoryController.listCategories);

export default router;
