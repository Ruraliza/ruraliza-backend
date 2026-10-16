// API pública do módulo da central de ajuda: o único arquivo que outros módulos enxergam (#modules/help).
export type * from './help.contract';
export type { HelpArticleRecord, HelpArticleRepository } from './domain/help-article';
export { createDefaultHelpArticles } from './application/default-help-articles';
export { createInMemoryHelpArticleRepository } from './infra/in-memory-help-article.repository';
export type { HelpRoutes } from './presentation/help.routes';
export { type HelpSchemaName, helpSchemas } from './presentation/help.schemas';
export { type HelpModuleDeps, type HelpUseCases, createHelpRoutes, createHelpUseCases } from './help.module';
