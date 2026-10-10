import type { UseCases } from '../container';
import { createAuthController } from '../controllers/AuthController';
import { createEventController } from '../controllers/EventController';
import { createFarmController } from '../controllers/FarmController';
import { createFarmerController } from '../controllers/FarmerController';
import { createJobController } from '../controllers/JobController';
import { createPhotoController } from '../controllers/PhotoController';
import { createResumeController } from '../controllers/ResumeController';
import { createServiceController } from '../controllers/ServiceController';
import { createWorkerController } from '../controllers/WorkerController';
import type { RouteGroup } from '../http/route';
import { authRoutes } from './authRoutes';
import { categoryRoutes } from './categoryRoutes';
import { documentRoutes } from './documentRoutes';
import { farmerRoutes } from './farmerRoutes';
import { imageRoutes } from './imageRoutes';
import { systemRoutes } from './systemRoutes';
import { workerRoutes } from './workerRoutes';

// Todas as rotas da API. O app monta estas e o OpenAPI é gerado a partir delas,
// então rota e documentação não têm como divergir.
export function createRouteGroups(useCases: UseCases): readonly RouteGroup[] {
  const auth = createAuthController(useCases.auth);
  const farmers = createFarmerController(useCases.farmers);
  const farms = createFarmController(useCases.farms);
  const services = createServiceController(useCases.services, useCases.hiring);
  const workers = createWorkerController(useCases.workers);
  const jobs = createJobController(useCases.services, useCases.hiring);
  const photos = createPhotoController(useCases.photos);
  const resumes = createResumeController(useCases.resumes);
  const events = createEventController(useCases.services, useCases.workers);

  return [
    { prefix: '/api/auth', routes: authRoutes(auth) },
    { prefix: '/api/farmers', routes: farmerRoutes({ farmers, farms, services, photos, auth, events }) },
    { prefix: '/api/workers', routes: workerRoutes({ workers, jobs, photos, resumes, auth, events }) },
    { prefix: '/api/images', routes: imageRoutes(photos) },
    { prefix: '/api/documents', routes: documentRoutes(resumes) },
    { prefix: '/api/categories', routes: categoryRoutes },
    { prefix: '/api', routes: systemRoutes }
  ];
}
