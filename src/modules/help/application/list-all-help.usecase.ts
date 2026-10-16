import { byTopicAndPosition } from '../domain/help-article';
import type { HelpArticle } from '../help.contract';
import type { HelpDeps } from './help-deps';

// Gestão (equipe): todas, inclusive os rascunhos.
export class ListAllHelpUseCase {
  constructor(private readonly deps: HelpDeps) {}

  async execute(): Promise<HelpArticle[]> {
    return (await this.deps.helpArticles.find()).sort(byTopicAndPosition);
  }
}
