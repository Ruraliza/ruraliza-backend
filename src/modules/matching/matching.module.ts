import type { AccessPolicies } from '#modules/auth';
import type { RouteDef } from '#shared/infra/http/route';
import { GetJobPreferencesUseCase } from './application/get-job-preferences.usecase';
import { JobAlerts } from './application/job-alerts';
import type { MatchingDeps } from './application/matching-deps';
import { RecommendJobsUseCase } from './application/recommend-jobs.usecase';
import { SaveJobPreferencesUseCase } from './application/save-job-preferences.usecase';
import { createMatchingController } from './presentation/matching.controller';
import { matchingRoutes } from './presentation/matching.routes';

export type MatchingModuleDeps = MatchingDeps;

export interface MatchingUseCases {
  getPreferences: GetJobPreferencesUseCase;
  savePreferences: SaveJobPreferencesUseCase;
  recommend: RecommendJobsUseCase;
  // Avisos de vaga nova (ligados na publicação pelo container) e o resumo semanal (app.ts agenda).
  alerts: JobAlerts;
}

// Casos de uso das vagas para você (montados pelo container).
export function createMatchingUseCases(deps: MatchingModuleDeps): MatchingUseCases {
  const recommend = new RecommendJobsUseCase(deps);
  return {
    getPreferences: new GetJobPreferencesUseCase(deps),
    savePreferences: new SaveJobPreferencesUseCase(deps),
    recommend,
    alerts: new JobAlerts(deps, recommend)
  };
}

// Rotas HTTP (em /api/workers).
export function createMatchingRoutes(useCases: MatchingUseCases, access: AccessPolicies): readonly RouteDef[] {
  return matchingRoutes(createMatchingController(useCases), access);
}
