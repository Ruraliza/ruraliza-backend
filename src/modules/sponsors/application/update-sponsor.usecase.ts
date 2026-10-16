import { type Result, notFound, ok } from '#shared/domain/result';
import { type SponsorRecord, checkPeriod } from '../domain/sponsor';
import type { Sponsor, SponsorUpdate } from '../sponsor.contract';
import { SPONSOR_NOT_FOUND, type SponsorDeps } from './sponsor-deps';

// Muda só o que veio; os números (aparições e cliques) continuam.
export class UpdateSponsorUseCase {
  constructor(private readonly deps: SponsorDeps) {}

  async execute({ id, changes }: { id: number; changes: SponsorUpdate }): Promise<Result<Sponsor>> {
    const current = await this.deps.sponsors.findById(id);
    if (!current) return notFound(SPONSOR_NOT_FOUND);
    const updated: SponsorRecord = { ...current, ...changes, text: changes.text === undefined ? current.text : changes.text, updated_at: this.deps.clock.now() };
    const period = checkPeriod(updated.starts_on, updated.ends_on);
    if (!period.ok) return period;
    await this.deps.sponsors.update(updated);
    return ok(updated);
  }
}
