import { createAccountRoutes } from '#modules/accounts';
import { createFarmRoutes } from '#modules/farms';
import { createHiringRoutes } from '#modules/hiring';
import { createPhotoRoutes } from '#modules/media';
import { createPushRoutes } from '#modules/notifications';
import { categoryRoutes, createServiceRoutes } from '#modules/services';
import type { RouteGroup } from '#shared/infra/http/route';
import type { Container } from '../container';
import { createAdminController } from '../controllers/AdminController';
import { createAuthController } from '../controllers/AuthController';
import { createEventController } from '../controllers/EventController';
import { createFarmerController } from '../controllers/FarmerController';
import { createResumeController } from '../controllers/ResumeController';
import { createWorkerController } from '../controllers/WorkerController';
import { createAccess } from '../http/access';
import { adminRoutes } from './adminRoutes';
import { authRoutes } from './authRoutes';
import { documentRoutes } from './documentRoutes';
import { farmerRoutes } from './farmerRoutes';
import { systemRoutes } from './systemRoutes';
import { workerRoutes } from './workerRoutes';

// Todas as rotas da API. O app monta estas e o OpenAPI é gerado a partir delas,
// então rota e documentação não têm como divergir.
export function createRouteGroups({ useCases, repos, tokens }: Pick<Container, 'useCases' | 'repos' | 'tokens'>): readonly RouteGroup[] {
  const access = createAccess({ repos, tokens });
  const auth = createAuthController(useCases.auth, useCases.systemUsers, tokens);
  const push = createPushRoutes(useCases.push, access);
  const farmers = createFarmerController(useCases.farmers, tokens);
  const workers = createWorkerController(useCases.workers, tokens);
  const photos = createPhotoRoutes(useCases.photos, access);
  const resumes = createResumeController(useCases.resumes);
  const events = createEventController(useCases.workers);
  const hiring = createHiringRoutes(useCases.hiring, access);
  const services = createServiceRoutes(useCases.services, access);
  const admin = createAdminController({ admin: useCases.admin, farmers: useCases.farmers, workers: useCases.workers, photos: useCases.photos, systemUsers: useCases.systemUsers });

  return [
    { prefix: '/api/auth', routes: authRoutes(auth, access) },
    { prefix: '/api/accounts', routes: createAccountRoutes(useCases.accounts, push.account, access) },
    { prefix: '/api/farmers', routes: farmerRoutes({ farmers, auth }, { farms: createFarmRoutes(useCases.farms, access), services, hiring, photos }, access) },
    { prefix: '/api/workers', routes: workerRoutes({ workers, resumes, auth, events }, { services, hiring, photos }, access) },
    { prefix: '/api/admin', routes: adminRoutes(admin, access) },
    { prefix: '/api/images', routes: photos.images },
    { prefix: '/api/documents', routes: documentRoutes(resumes) },
    { prefix: '/api/categories', routes: categoryRoutes },
    { prefix: '/api', routes: [...systemRoutes, ...push.config] }
  ];
}
