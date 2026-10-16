import type { Sponsor } from '../sponsor.contract';
import type { SponsorDeps } from './sponsor-deps';

// Todos os patrocínios, o atualizado por último primeiro.
export class ListSponsorsUseCase {
  constructor(private readonly deps: SponsorDeps) {}

  async execute(): Promise<Sponsor[]> {
    return (await this.deps.sponsors.find()).sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id);
  }
}
