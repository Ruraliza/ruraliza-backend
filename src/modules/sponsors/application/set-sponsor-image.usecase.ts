import { releaseImage } from '#shared/domain/images';
import { type Result, notFound, ok } from '#shared/domain/result';
import type { Sponsor } from '../sponsor.contract';
import { SPONSOR_NOT_FOUND, type SponsorDeps } from './sponsor-deps';

// Logo ou foto do patrocínio (≤ 1000px, WebP, sem metadados); troca a anterior.
export class SetSponsorImageUseCase {
  constructor(private readonly deps: SponsorDeps) {}

  async execute({ id, upload }: { id: number; upload: Uint8Array }): Promise<Result<Sponsor>> {
    const { sponsors, images, clock } = this.deps;
    const current = await sponsors.findById(id);
    if (!current) return notFound(SPONSOR_NOT_FOUND);
    const image = await images.processor.normalize(upload);
    if (!image.ok) return image;
    const imageId = await images.store.save(image.value);
    await releaseImage(images.store, current.image_url);
    const updated = { ...current, image_url: images.store.urlFor(imageId), updated_at: clock.now() };
    await sponsors.update(updated);
    return ok(updated);
  }
}
