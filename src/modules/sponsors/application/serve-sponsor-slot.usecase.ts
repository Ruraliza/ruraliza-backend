import { dayOf } from '#shared/domain/dates';
import { type SlotRequest, fitsSlot, toSponsorCard } from '../domain/sponsor';
import type { SponsorCard } from '../sponsor.contract';
import type { SponsorDeps } from './sponsor-deps';

// O patrocínio da vez para quem pediu: entre os que servem (público, período, UF e interesses), o que menos
// apareceu até agora, para todos terem a sua vez. Conta a aparição. Sem nenhum, null.
export class ServeSponsorSlotUseCase {
  constructor(private readonly deps: SponsorDeps) {}

  async execute(request: Omit<SlotRequest, 'today'>): Promise<SponsorCard | null> {
    const today = dayOf(this.deps.clock.now());
    const fitting = (await this.deps.sponsors.find({ active: true })).filter((s) => fitsSlot(s, { ...request, today }));
    const [next] = fitting.sort((a, b) => a.impressions - b.impressions || a.id - b.id);
    if (!next) return null;
    await this.deps.sponsors.update({ ...next, impressions: next.impressions + 1 });
    return toSponsorCard(next);
  }
}
