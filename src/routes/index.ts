import type { UseCases } from '../container';
import { createFarmController } from '../controllers/FarmController';
import { createFarmerController } from '../controllers/FarmerController';
import { createJobController } from '../controllers/JobController';
import { createServiceController } from '../controllers/ServiceController';
import { createWorkerController } from '../controllers/WorkerController';
import type { RouteGroup } from '../http/route';
import { categoryRoutes } from './categoryRoutes';
import { farmerRoutes } from './farmerRoutes';
import { systemRoutes } from './systemRoutes';
import { workerRoutes } from './workerRoutes';

// Todas as rotas da API. O app monta estas e o OpenAPI é gerado a partir delas,
// então rota e documentação não têm como divergir.
export function createRouteGroups(useCases: UseCases): readonly RouteGroup[] {
  const farmers = createFarmerController(useCases.farmers);
  const farms = createFarmController(useCases.farms);
  const services = createServiceController(useCases.services, useCases.hiring);
  const workers = createWorkerController(useCases.workers);
  const jobs = createJobController(useCases.services, useCases.hiring);

  return [
    { prefix: '/api/farmers', routes: farmerRoutes({ farmers, farms, services }) },
    { prefix: '/api/workers', routes: workerRoutes({ workers, jobs }) },
    { prefix: '/api/categories', routes: categoryRoutes },
    { prefix: '/api', routes: systemRoutes }
  ];
}
