import type { AccessPolicies } from '#modules/auth';
import { sendCatalogNotices } from './application/catalog-notices';
import { CatalogUseCase } from './application/catalog.usecase';
import { GetJobPreferencesUseCase } from './application/get-job-preferences.usecase';
import { JobAlerts } from './application/job-alerts';
import type { MatchingDeps } from './application/matching-deps';
import { RecommendJobsUseCase } from './application/recommend-jobs.usecase';
import { SaveJobPreferencesUseCase } from './application/save-job-preferences.usecase';
import { createMatchingController } from './presentation/matching.controller';
import { type MatchingRoutes, matchingRoutes } from './presentation/matching.routes';

export type MatchingModuleDeps = MatchingDeps;

export interface MatchingUseCases {
  getPreferences: GetJobPreferencesUseCase;
  savePreferences: SaveJobPreferencesUseCase;
  recommend: RecommendJobsUseCase;
  // Avisos de vaga nova (ligados na publicação pelo container) e o resumo semanal (app.ts agenda).
  alerts: JobAlerts;
  // Catálogo de prestadores de uma vaga; também confere, para os convites, se alguém está nele.
  catalog: CatalogUseCase;
  // Aviso único do catálogo para as contas de antes dele (app.ts chama na subida).
  sendCatalogNotices(): Promise<number>;
}

// Casos de uso das vagas para você (montados pelo container).
export function createMatchingUseCases(deps: MatchingModuleDeps): MatchingUseCases {
  const recommend = new RecommendJobsUseCase(deps);
  return {
    getPreferences: new GetJobPreferencesUseCase(deps),
    savePreferences: new SaveJobPreferencesUseCase(deps),
    recommend,
    alerts: new JobAlerts(deps, recommend),
    catalog: new CatalogUseCase(deps),
    sendCatalogNotices: () => sendCatalogNotices(deps)
  };
}

// Rotas HTTP (preferências e recomendações em /api/workers, o catálogo da vaga em /api/farmers).
export function createMatchingRoutes(useCases: MatchingUseCases, access: AccessPolicies): MatchingRoutes {
  return matchingRoutes(createMatchingController(useCases), access);
}
