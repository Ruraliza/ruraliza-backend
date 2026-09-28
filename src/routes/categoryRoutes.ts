import * as CategoryController from '../controllers/CategoryController';
import { TAGS, operation } from '../docs/operations';
import { type RouteDef, route } from '../http/route';

// Montadas em /api/categories.
export const categoryRoutes: readonly RouteDef[] = [
  route('get', '/', CategoryController.listCategories, operation({
    tag: TAGS.categories,
    summary: 'Listar categorias de serviço',
    description: 'Lista fixa usada ao publicar serviços e ao filtrar vagas.',
    success: { status: 200, description: 'Categorias.', schema: 'CategoryList' }
  }))
];
