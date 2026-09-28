import { CATEGORIES } from '../constants/categories';
import type { Handler } from '../http/types';

// GET /api/categories - Lista fixa de categorias de serviço
export const listCategories: Handler<readonly string[]> = (_req, res) => {
  return res.status(200).json(CATEGORIES);
};
