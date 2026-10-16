import type { AccessPolicies } from '#modules/auth';
import { CreateHelpArticleUseCase } from './application/create-help-article.usecase';
import { DeleteHelpArticleUseCase } from './application/delete-help-article.usecase';
import type { HelpDeps } from './application/help-deps';
import { ListAllHelpUseCase } from './application/list-all-help.usecase';
import { ListPublishedHelpUseCase } from './application/list-published-help.usecase';
import { MoveHelpArticleUseCase } from './application/move-help-article.usecase';
import { UpdateHelpArticleUseCase } from './application/update-help-article.usecase';
import { createHelpController } from './presentation/help.controller';
import { type HelpRoutes, helpRoutes } from './presentation/help.routes';

export type HelpModuleDeps = HelpDeps;

export interface HelpUseCases {
  listPublished: ListPublishedHelpUseCase;
  listAll: ListAllHelpUseCase;
  create: CreateHelpArticleUseCase;
  update: UpdateHelpArticleUseCase;
  move: MoveHelpArticleUseCase;
  remove: DeleteHelpArticleUseCase;
}

// Casos de uso da central de ajuda (montados pelo container).
export function createHelpUseCases(deps: HelpModuleDeps): HelpUseCases {
  return {
    listPublished: new ListPublishedHelpUseCase(deps),
    listAll: new ListAllHelpUseCase(deps),
    create: new CreateHelpArticleUseCase(deps),
    update: new UpdateHelpArticleUseCase(deps),
    move: new MoveHelpArticleUseCase(deps),
    remove: new DeleteHelpArticleUseCase(deps)
  };
}

// Rotas HTTP (pública em /api/help; gestão em /api/admin/help).
export function createHelpRoutes(useCases: HelpUseCases, access: AccessPolicies): HelpRoutes {
  return helpRoutes(createHelpController(useCases), access);
}
