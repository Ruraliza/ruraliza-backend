import { type Result, notFound, ok } from '#shared/domain/result';
import { SPONSOR_NOT_FOUND, type SponsorDeps } from './sponsor-deps';

// Alguém abriu o link do patrocínio: conta o clique (o app abre o endereço direto).
export class CountSponsorClickUseCase {
  constructor(private readonly deps: SponsorDeps) {}

  async execute({ id }: { id: number }): Promise<Result<true>> {
    const sponsor = await this.deps.sponsors.findById(id);
    if (!sponsor) return notFound(SPONSOR_NOT_FOUND);
    await this.deps.sponsors.update({ ...sponsor, clicks: sponsor.clicks + 1 });
    return ok(true);
  }
}
