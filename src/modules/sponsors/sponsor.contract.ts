import type { MessageResponse } from '#shared/contracts/api';

// Espaço de patrocínio (issue #17): lojas agropecuárias, revendas de máquinas e marcas de sementes da região
// aparecem num cartão marcado como "Patrocinado", para produtores, trabalhadores ou os dois. A equipe cadastra
// e acompanha quantas vezes cada um apareceu e foi aberto. Nenhum dado de quem usa o app vai para o anunciante.

export type SponsorAudience = 'farmer' | 'worker' | 'all';

// O cartão como o app mostra (GET /sponsors/slot). Ao abrir o link, o app avisa POST /sponsors/:id/click (conta).
export interface SponsorCard {
  id: number;
  sponsor: string; // nome do anunciante
  title: string; // a chamada
  text: string | null; // um detalhe curto
  cta_label: string; // texto do botão
  url: string; // https://, para onde o botão leva
  image_url: string | null; // logo ou foto (opcional)
}

// GET /admin/sponsors: o patrocínio completo, com a segmentação e os números.
export interface Sponsor extends SponsorCard {
  audience: SponsorAudience;
  states: string[]; // UFs onde aparece (vazio: todo o Brasil)
  categories: string[]; // para trabalhadores, categorias de interesse que combinam (vazio: qualquer uma)
  starts_on: string | null; // AAAA-MM-DD (vazio: já)
  ends_on: string | null; // AAAA-MM-DD, último dia (vazio: sem fim)
  active: boolean;
  impressions: number; // vezes que apareceu
  clicks: number; // vezes que o botão foi aberto
  updated_at: string;
}

// POST /admin/sponsors
export interface SponsorInput {
  sponsor: string;
  title: string;
  text?: string | null;
  cta_label: string;
  url: string;
  audience: SponsorAudience;
  states?: string[];
  categories?: string[];
  starts_on?: string | null;
  ends_on?: string | null;
  active?: boolean;
}

// PATCH /admin/sponsors/:id: só o que mudou.
export type SponsorUpdate = Partial<SponsorInput>;

export interface SponsorResponse extends MessageResponse {
  sponsor: Sponsor;
}

// GET /sponsors/slot: o patrocínio da vez (null quando não há nenhum para quem pediu).
export interface SponsorSlotResponse {
  card: SponsorCard | null;
}
