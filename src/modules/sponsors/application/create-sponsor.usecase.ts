import { type Result, ok } from '#shared/domain/result';
import { checkPeriod } from '../domain/sponsor';
import type { Sponsor, SponsorInput } from '../sponsor.contract';
import type { SponsorDeps } from './sponsor-deps';

// Patrocínio novo (ativo por padrão, sem imagem; a logo vai depois, em POST /admin/sponsors/:id/image).
export class CreateSponsorUseCase {
  constructor(private readonly deps: SponsorDeps) {}

  async execute(input: SponsorInput): Promise<Result<Sponsor>> {
    const period = checkPeriod(input.starts_on ?? null, input.ends_on ?? null);
    if (!period.ok) return period;
    const sponsor = await this.deps.sponsors.create({
      sponsor: input.sponsor, title: input.title, text: input.text ?? null, cta_label: input.cta_label, url: input.url, image_url: null,
      audience: input.audience, states: input.states ?? [], categories: input.categories ?? [], starts_on: input.starts_on ?? null,
      ends_on: input.ends_on ?? null, active: input.active ?? true, impressions: 0, clicks: 0, updated_at: this.deps.clock.now()
    });
    return ok(sponsor);
  }
}
