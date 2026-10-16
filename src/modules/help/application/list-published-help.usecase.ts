import { byTopicAndPosition } from '../domain/help-article';
import type { HelpArticle } from '../help.contract';
import type { HelpDeps } from './help-deps';

// Central de ajuda pública: só as perguntas publicadas, na ordem da tela.
export class ListPublishedHelpUseCase {
  constructor(private readonly deps: HelpDeps) {}

  async execute(): Promise<HelpArticle[]> {
    return (await this.deps.helpArticles.find({ published: true })).sort(byTopicAndPosition);
  }
}
