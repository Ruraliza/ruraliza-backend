import type { Clock } from '#shared/domain/clock';
import type { HelpArticleRepository } from '../domain/help-article';
import type { HelpTopic } from '../help.contract';

export interface HelpDeps {
  helpArticles: HelpArticleRepository;
  clock: Clock;
}

// Posição de uma pergunta nova no fim do tema.
export async function nextPosition(helpArticles: HelpArticleRepository, topic: HelpTopic): Promise<number> {
  const inTopic = await helpArticles.find({ topic });
  return inTopic.reduce((max, a) => Math.max(max, a.position), 0) + 1;
}
