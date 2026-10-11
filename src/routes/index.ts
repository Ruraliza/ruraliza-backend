import { createFarmRoutes } from '#modules/farms';
import { createHiringRoutes } from '#modules/hiring';
import { createPushRoutes } from '#modules/notifications';
import { categoryRoutes, createServiceRoutes } from '#modules/services';
import type { RouteGroup } from '#shared/infra/http/route';
import type { Container } from '../container';
import { createAccountController } from '../controllers/AccountController';
import { createAdminController } from '../controllers/AdminController';
import { createAuthController } from '../controllers/AuthController';
import { createEventController } from '../controllers/EventController';
import { createFarmerController } from '../controllers/FarmerController';
import { createPhotoController } from '../controllers/PhotoController';
import { createResumeController } from '../controllers/ResumeController';
import { createWorkerController } from '../controllers/WorkerController';
import { createAccess } from '../http/access';
import { accountRoutes } from './accountRoutes';
import { adminRoutes } from './adminRoutes';
import { authRoutes } from './authRoutes';
import { documentRoutes } from './documentRoutes';
import { farmerRoutes } from './farmerRoutes';
import { imageRoutes } from './imageRoutes';
import { systemRoutes } from './systemRoutes';
import { workerRoutes } from './workerRoutes';

// Todas as rotas da API. O app monta estas e o OpenAPI é gerado a partir delas,
// então rota e documentação não têm como divergir.
export function createRouteGroups({ useCases, repos, tokens }: Pick<Container, 'useCases' | 'repos' | 'tokens'>): readonly RouteGroup[] {
  const access = createAccess({ repos, tokens });
  const auth = createAuthController(useCases.auth, useCases.systemUsers, tokens);
  const accounts = createAccountController(useCases.accounts);
  const push = createPushRoutes(useCases.push, access);
  const farmers = createFarmerController(useCases.farmers, tokens);
  const workers = createWorkerController(useCases.workers, tokens);
  const photos = createPhotoController(useCases.photos);
  const resumes = createResumeController(useCases.resumes);
  const events = createEventController(useCases.workers);
  const hiring = createHiringRoutes(useCases.hiring, access);
  const services = createServiceRoutes(useCases.services, access);
  const admin = createAdminController({ admin: useCases.admin, farmers: useCases.farmers, workers: useCases.workers, photos: useCases.photos, systemUsers: useCases.systemUsers });

  return [
    { prefix: '/api/auth', routes: authRoutes(auth, access) },
    { prefix: '/api/accounts', routes: accountRoutes(accounts, push.account, access) },
    { prefix: '/api/farmers', routes: farmerRoutes({ farmers, photos, auth }, { farms: createFarmRoutes(useCases.farms, access), services, hiring }, access) },
    { prefix: '/api/workers', routes: workerRoutes({ workers, photos, resumes, auth, events }, { services, hiring }, access) },
    { prefix: '/api/admin', routes: adminRoutes(admin, access) },
    { prefix: '/api/images', routes: imageRoutes(photos) },
    { prefix: '/api/documents', routes: documentRoutes(resumes) },
    { prefix: '/api/categories', routes: categoryRoutes },
    { prefix: '/api', routes: [...systemRoutes, ...push.config] }
  ];
}
