import { releaseImage } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { Sponsor } from '../sponsor.contract';
import { SPONSOR_NOT_FOUND, type SponsorDeps } from './sponsor-deps';

// Tira a logo do patrocínio (a imagem é apagada).
export class RemoveSponsorImageUseCase {
  constructor(private readonly deps: SponsorDeps) {}

  async execute({ id }: { id: number }): Promise<Result<Sponsor>> {
    const current = await this.deps.sponsors.findById(id);
    if (!current) return notFound(SPONSOR_NOT_FOUND);
    await releaseImage(this.deps.images.store, current.image_url);
    const updated = { ...current, image_url: null, updated_at: this.deps.clock.now() };
    await this.deps.sponsors.update(updated);
    return ok(updated);
  }
}
