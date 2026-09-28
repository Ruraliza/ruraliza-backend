import type { RouteGroup } from '../http/route';
import { categoryRoutes } from './categoryRoutes';
import { farmerRoutes } from './farmerRoutes';
import { systemRoutes } from './systemRoutes';
import { workerRoutes } from './workerRoutes';

// Todas as rotas da API. O app monta estas e o OpenAPI é gerado a partir delas,
// então rota e documentação não têm como divergir.
export const routeGroups: readonly RouteGroup[] = [
  { prefix: '/api/farmers', routes: farmerRoutes },
  { prefix: '/api/workers', routes: workerRoutes },
  { prefix: '/api/categories', routes: categoryRoutes },
  { prefix: '/api', routes: systemRoutes }
];
