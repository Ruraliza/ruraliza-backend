import { type Result, notFound, ok } from '#shared/domain/result';
import type { HelpDeps } from './help-deps';

// Apaga a pergunta (a central de ajuda não guarda histórico).
export class DeleteHelpArticleUseCase {
  constructor(private readonly deps: HelpDeps) {}

  async execute({ id }: { id: number }): Promise<Result<null>> {
    const article = await this.deps.helpArticles.findById(id);
    if (!article) return notFound('Pergunta não encontrada.');
    await this.deps.helpArticles.delete(id);
    return ok(null);
  }
}
