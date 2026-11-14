import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { HelpArticleRepository } from '../domain/help-article';

export function createPgHelpArticleRepository(db: Database): HelpArticleRepository {
  return new PgRepository(db, 'help_articles', {
    question: 'value', answer: 'value', topic: 'value', position: 'value', published: 'value', updated_at: 'value'
  }, ['topic', 'published']);
}
