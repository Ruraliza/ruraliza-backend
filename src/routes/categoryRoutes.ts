import * as CategoryController from '../controllers/CategoryController';
import { TAGS, operation } from '../docs/operations';
import { PUBLIC_ROUTE } from '../http/access';
import { type RouteDef, route } from '#shared/infra/http/route';

// Montadas em /api/categories.
export const categoryRoutes: readonly RouteDef[] = [
  route('get', '/', CategoryController.listCategories, operation({
    tag: TAGS.categories,
    summary: 'Listar categorias de serviço',
    description: 'Lista fixa usada ao publicar serviços e ao filtrar vagas.',
    success: { status: 200, description: 'Categorias.', schema: 'CategoryList' }
  }), PUBLIC_ROUTE)
];
