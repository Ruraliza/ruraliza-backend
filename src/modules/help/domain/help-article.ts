import type { Repository } from '#shared/domain/repository';
import type { HelpArticle, HelpTopic } from '../help.contract';

// Pergunta da central de ajuda como fica guardada (igual à resposta da API).
// TODO(db): tabela `help_articles (id, question, answer, topic, position, published, updated_at)`.
export type HelpArticleRecord = HelpArticle;

export type HelpArticleRepository = Repository<HelpArticleRecord, 'topic' | 'published'>;

export const HELP_TOPICS: readonly HelpTopic[] = ['comecar', 'produtores', 'trabalhadores', 'pagamentos', 'seguranca', 'trilhas', 'conta'];

export const QUESTION_MAX_LENGTH = 160;
export const ANSWER_MAX_LENGTH = 2000;

// Ordem da tela: pelos temas (na ordem de HELP_TOPICS) e, dentro de cada um, pela posição.
export function byTopicAndPosition(a: HelpArticle, b: HelpArticle): number {
  return HELP_TOPICS.indexOf(a.topic) - HELP_TOPICS.indexOf(b.topic) || a.position - b.position || a.id - b.id;
}
