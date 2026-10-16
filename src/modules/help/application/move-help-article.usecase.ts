import { type Result, notFound, ok } from '#shared/domain/result';
import { byTopicAndPosition } from '../domain/help-article';
import type { HelpArticle } from '../help.contract';
import type { HelpDeps } from './help-deps';

// Sobe ou desce uma posição dentro do tema (troca com a vizinha). Na ponta, nada muda.
export class MoveHelpArticleUseCase {
  constructor(private readonly deps: HelpDeps) {}

  async execute({ id, direction }: { id: number; direction: 'up' | 'down' }): Promise<Result<HelpArticle>> {
    const { helpArticles } = this.deps;
    const article = await helpArticles.findById(id);
    if (!article) return notFound('Pergunta não encontrada.');

    const siblings = (await helpArticles.find({ topic: article.topic })).sort(byTopicAndPosition);
    const index = siblings.findIndex((a) => a.id === article.id);
    const neighbor = siblings[direction === 'up' ? index - 1 : index + 1];
    if (!neighbor) return ok(article);

    await helpArticles.update({ ...neighbor, position: article.position });
    const moved = { ...article, position: neighbor.position };
    await helpArticles.update(moved);
    return ok(moved);
  }
}
