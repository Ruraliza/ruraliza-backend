import { TAGS, operation } from '#shared/infra/docs/operations';
import { PUBLIC_ROUTE } from '#shared/infra/http/access';
import { type RouteDef, route } from '#shared/infra/http/route';
import type { Handler } from '#shared/infra/http/types';
import { CATEGORIES, CATEGORY_GROUPS, type ServiceGroup } from '../domain/categories';
import type { ServiceSchemaName } from './service.schemas';

// GET /api/categories - Lista fixa de categorias de serviço
const listCategories: Handler<readonly string[]> = (_req, res) => {
  return res.status(200).json(CATEGORIES);
};

// GET /api/categories/groups - Os mesmos tipos de serviço, organizados em grupos
const listCategoryGroups: Handler<readonly ServiceGroup[]> = (_req, res) => {
  return res.status(200).json(CATEGORY_GROUPS);
};

// Montadas em /api/categories.
export const categoryRoutes: readonly RouteDef[] = [
  route('get', '/', listCategories, operation<ServiceSchemaName>({
    tag: TAGS.categories,
    summary: 'Listar categorias de serviço',
    description: 'Lista fixa e plana dos tipos de serviço, usada ao publicar serviços e ao filtrar vagas. ' +
      'É o que se grava em `category`. Os mesmos valores, por grupo, estão em GET /api/categories/groups.',
    success: { status: 200, description: 'Categorias.', schema: 'CategoryList' }
  }), PUBLIC_ROUTE),
  route('get', '/groups', listCategoryGroups, operation<ServiceSchemaName>({
    tag: TAGS.categories,
    summary: 'Listar categorias de serviço por grupo',
    description: 'Os tipos de serviço em dois níveis (grupo > serviço), na mesma ordem de GET /api/categories. ' +
      'Cada serviço está em um só grupo. O grupo serve para escolher e filtrar (`category_group` em GET /api/workers/services); o que se grava é o serviço.',
    success: { status: 200, description: 'Grupos com os seus serviços.', schema: 'CategoryGroupList' }
  }), PUBLIC_ROUTE)
];
