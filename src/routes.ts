import { createAccountRoutes } from '#modules/accounts';
import { createAdminRoutes } from '#modules/admin';
import { createChatRoutes } from '#modules/chat';
import { createAccess, createAuthRoutes } from '#modules/auth';
import { createFarmerRoutes } from '#modules/farmers';
import { createFarmRoutes } from '#modules/farms';
import { createFarmStatsRoutes } from '#modules/farm-stats';
import { createHelpRoutes } from '#modules/help';
import { createHiringRoutes } from '#modules/hiring';
import { createLiveRoutes } from '#modules/live';
import { createMatchingRoutes } from '#modules/matching';
import { createPhotoRoutes } from '#modules/media';
import { createNotificationRoutes, createPushRoutes } from '#modules/notifications';
import { platformRoutes } from '#modules/platform';
import { createReportRoutes } from '#modules/reports';
import { createReviewRoutes } from '#modules/reviews';
import { categoryRoutes, createServiceRoutes } from '#modules/services';
import { createSystemUserRoutes } from '#modules/system-users';
import { createTrackRoutes } from '#modules/tracks';
import { createVerificationRoutes } from '#modules/verification';
import { createWorkerRoutes } from '#modules/workers';
import type { RouteGroup } from '#shared/infra/http/route';
import type { Container } from './container';

// Todas as rotas da API, por prefixo. O app monta estas e o OpenAPI é gerado a partir delas,
// então rota e documentação não têm como divergir. Cada módulo entrega os seus grupos; aqui fica
// só a ordem dentro de cada prefixo (atenção: '/services/...' antes de '/:id').
export function createRouteGroups({ useCases, repos, tokens, changes }: Pick<Container, 'useCases' | 'repos' | 'tokens' | 'changes'>): readonly RouteGroup[] {
  const access = createAccess({ repos, tokens });
  const auth = createAuthRoutes(useCases.auth, tokens, access);
  const systemUsers = createSystemUserRoutes(useCases.systemUsers, tokens, access);
  const push = createPushRoutes(useCases.push, access);
  const notifications = createNotificationRoutes(useCases.notifications, access);
  const farmers = createFarmerRoutes(useCases.farmers, tokens, access);
  const farms = createFarmRoutes(useCases.farms, access);
  const workers = createWorkerRoutes(useCases.workers, tokens, access);
  const photos = createPhotoRoutes(useCases.photos, access);
  const services = createServiceRoutes(useCases.services, access);
  const hiring = createHiringRoutes(useCases.hiring, access);
  const reviews = createReviewRoutes(useCases.reviews, access);
  const chat = createChatRoutes(useCases.chat, access);
  const tracks = createTrackRoutes(useCases.tracks, access);
  const help = createHelpRoutes(useCases.help, access);
  const reports = createReportRoutes(useCases.reports, access);
  const verification = createVerificationRoutes(useCases.verification, access);
  const live = createLiveRoutes(changes, access);
  const matching = createMatchingRoutes(useCases.matching, access);
  const farmStats = createFarmStatsRoutes(useCases.farmStats, access);

  return [
    { prefix: '/api/auth', routes: [...auth.auth, ...systemUsers.auth] },
    { prefix: '/api/accounts', routes: createAccountRoutes(useCases.accounts, push.account, access) },
    {
      prefix: '/api/farmers',
      routes: [
        ...services.services, // publicar, ver, editar e cancelar
        ...hiring.farmer, // candidaturas, avisos, aceite e pagamento
        ...reviews.farmer, // avaliar o trabalhador e o que falta avaliar
        ...chat.farmer, // conversas do produtor
        ...live.farmer, // avisos em tempo real: um stream só por aba
        ...farmStats, // painel da fazenda
        ...notifications.farmer, // central de notificações
        ...reports.farmer, // denunciar um trabalhador
        ...verification.farmer, // verificação de identidade
        ...farmers, // cadastro e perfil
        ...auth.farmerPassword,
        ...photos.farmer,
        ...farms,
        ...photos.farm,
        ...services.farmerServices
      ]
    },
    {
      prefix: '/api/workers',
      routes: [
        ...services.jobs, // buscar e ver vagas
        ...tracks.learning, // trilhas de estudo: lista, detalhe e matrícula
        ...hiring.worker, // candidatura e desistência
        ...reviews.worker, // avaliar a fazenda e o que falta avaliar
        ...chat.worker, // conversas do trabalhador
        ...live.worker, // avisos em tempo real: um stream só por aba
        ...matching, // vagas para você: preferências e recomendações
        ...notifications.worker, // central de notificações
        ...reports.worker, // denunciar uma vaga ou um produtor
        ...verification.worker, // verificação de identidade
        ...workers.profile, // cadastro e perfil
        ...auth.workerPassword,
        ...photos.worker,
        ...workers.resume,
        ...workers.tracking, // candidaturas, avisos e serviços aceitos
        ...tracks.progress // estudo da trilha, aulas concluídas e certificados
      ]
    },
    { prefix: '/api/chats', routes: chat.chats },
    { prefix: '/api/reviews', routes: reviews.reputation },
    { prefix: '/api/admin', routes: [...createAdminRoutes(useCases, systemUsers.admin, access), ...tracks.manage, ...help.admin, ...reports.admin, ...verification.admin] },
    { prefix: '/api/help', routes: help.public },
    { prefix: '/api/images', routes: photos.images },
    { prefix: '/api/documents', routes: workers.documents },
    { prefix: '/api/categories', routes: categoryRoutes },
    { prefix: '/api/certificates', routes: tracks.certificates },
    { prefix: '/api', routes: [...platformRoutes, ...push.config] }
  ];
}
