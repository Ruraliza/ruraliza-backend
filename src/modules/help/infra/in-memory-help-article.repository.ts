import { InMemoryRepository } from '#shared/infra/memory/in-memory-repository';
import type { HelpArticleRepository } from '../domain/help-article';

export function createInMemoryHelpArticleRepository(): HelpArticleRepository {
  return new InMemoryRepository(['topic', 'published'], (data, id) => ({ id, ...data }));
}
