import { TAGS, operation } from '#shared/infra/docs/operations';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { Handler } from '#shared/infra/http/types';
import { PUBLIC_ROUTE } from '../../../http/access';
import { CATEGORIES } from '../domain/categories';
import type { ServiceSchemaName } from './service.schemas';

// GET /api/categories - Lista fixa de categorias de serviço
const listCategories: Handler<readonly string[]> = (_req, res) => {
  return res.status(200).json(CATEGORIES);
};

// Montadas em /api/categories.
export const categoryRoutes: readonly RouteDef[] = [
  route('get', '/', listCategories, operation<ServiceSchemaName>({
    tag: TAGS.categories,
    summary: 'Listar categorias de serviço',
    description: 'Lista fixa usada ao publicar serviços e ao filtrar vagas.',
    success: { status: 200, description: 'Categorias.', schema: 'CategoryList' }
  }), PUBLIC_ROUTE)
];
