import { releaseImage } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';
import { SPONSOR_NOT_FOUND, type SponsorDeps } from './sponsor-deps';

// Apaga o patrocínio e a imagem.
export class DeleteSponsorUseCase {
  constructor(private readonly deps: SponsorDeps) {}

  async execute({ id }: { id: number }): Promise<Result<true>> {
    const current = await this.deps.sponsors.findById(id);
    if (!current) return notFound(SPONSOR_NOT_FOUND);
    await releaseImage(this.deps.images.store, current.image_url);
    await this.deps.sponsors.delete(id);
    return ok(true);
  }
}
