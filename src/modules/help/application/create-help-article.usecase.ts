import type { HelpArticle, HelpArticleInput } from '../help.contract';
import { type HelpDeps, nextPosition } from './help-deps';

// Pergunta nova entra no fim do tema.
export class CreateHelpArticleUseCase {
  constructor(private readonly deps: HelpDeps) {}

  async execute(input: HelpArticleInput): Promise<HelpArticle> {
    const { helpArticles, clock } = this.deps;
    const position = await nextPosition(helpArticles, input.topic);
    return helpArticles.create({
      question: input.question, answer: input.answer, topic: input.topic, position,
      published: input.published ?? true, updated_at: clock.now()
    });
  }
}
