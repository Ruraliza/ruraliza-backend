import { type Result, notFound, ok } from '#shared/domain/result';
import type { HelpArticleRecord } from '../domain/help-article';
import type { HelpArticle, HelpArticleUpdate } from '../help.contract';
import { type HelpDeps, nextPosition } from './help-deps';

// Edita só o que veio. Mudou de tema: vai para o fim do tema novo.
export class UpdateHelpArticleUseCase {
  constructor(private readonly deps: HelpDeps) {}

  async execute({ id, changes }: { id: number; changes: HelpArticleUpdate }): Promise<Result<HelpArticle>> {
    const { helpArticles, clock } = this.deps;
    const article = await helpArticles.findById(id);
    if (!article) return notFound('Pergunta não encontrada.');

    const movedTopic = changes.topic !== undefined && changes.topic !== article.topic;
    const updated: HelpArticleRecord = {
      ...article,
      ...changes,
      position: movedTopic && changes.topic ? await nextPosition(helpArticles, changes.topic) : article.position,
      updated_at: clock.now()
    };
    await helpArticles.update(updated);
    return ok(updated);
  }
}
