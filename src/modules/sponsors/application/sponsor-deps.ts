import type { Clock } from '#shared/domain/clock';
import type { ImageProcessor, ImageStore } from '#shared/domain/images';
import type { SponsorRepository } from '../domain/sponsor';

export interface SponsorDeps {
  sponsors: SponsorRepository;
  // Imagens públicas (as mesmas de /api/images): a logo aparece para qualquer pessoa.
  images: { processor: ImageProcessor; store: ImageStore };
  clock: Clock;
}

export const SPONSOR_NOT_FOUND = 'Patrocínio não encontrado.';
