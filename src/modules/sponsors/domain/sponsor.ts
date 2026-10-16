import type { Repository } from '#shared/domain/repository';
import { type Result, invalid, ok } from '#shared/domain/result';
import type { Sponsor, SponsorAudience, SponsorCard } from '../sponsor.contract';

// Patrocínio como fica guardado. TODO(db): tabela `sponsors` (as UFs e categorias em text[]); os contadores
// podem ir para uma tabela de eventos por dia quando o volume crescer.
export type SponsorRecord = Sponsor;

export type SponsorRepository = Repository<SponsorRecord, 'active' | 'audience'>;

export const SPONSOR_AUDIENCES: readonly SponsorAudience[] = ['farmer', 'worker', 'all'];
export const SPONSOR_LIMITS = { sponsor: 60, title: 90, text: 180, cta_label: 24, url: 500 } as const;

// As 27 UFs.
export const BRAZIL_STATES: readonly string[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];

export function toSponsorCard({ id, sponsor, title, text, cta_label, url, image_url }: SponsorRecord): SponsorCard {
  return { id, sponsor, title, text, cta_label, url, image_url };
}

export interface SlotRequest {
  audience: 'farmer' | 'worker';
  state: string | null; // UF de quem vê (a das fazendas do produtor), se houver
  categories: readonly string[]; // interesses do trabalhador, se houver
  today: string; // AAAA-MM-DD
}

// Se o patrocínio pode aparecer para quem pediu: ativo, no período, para o público certo, na UF (quando
// segmentado por UF e a UF é conhecida) e, para trabalhadores, nas categorias de interesse (quando segmentado).
export function fitsSlot(sponsor: SponsorRecord, request: SlotRequest): boolean {
  if (!sponsor.active) return false;
  if (sponsor.starts_on !== null && sponsor.starts_on > request.today) return false;
  if (sponsor.ends_on !== null && sponsor.ends_on < request.today) return false;
  if (sponsor.audience !== 'all' && sponsor.audience !== request.audience) return false;
  if (sponsor.states.length > 0 && (request.state === null || !sponsor.states.includes(request.state))) return false;
  if (request.audience === 'worker' && sponsor.categories.length > 0 && request.categories.length > 0) {
    return sponsor.categories.some((c) => request.categories.includes(c));
  }
  return true;
}

// O período, quando tem as duas pontas, precisa estar em ordem.
export function checkPeriod(startsOn: string | null, endsOn: string | null): Result<true> {
  return startsOn !== null && endsOn !== null && endsOn < startsOn ? invalid('O último dia (ends_on) vem antes do primeiro (starts_on).') : ok(true);
}
