import { type RefTo, type Schema, id, input, isoDate, object, refTo } from '#shared/infra/docs/schema-kit';
import { BRAZIL_STATES, SPONSOR_AUDIENCES, SPONSOR_LIMITS } from '../domain/sponsor';

// Schemas OpenAPI dos patrocínios (contrato em ../sponsor.contract.ts). Registrados em src/docs/schemas.ts.
export type SponsorSchemaName = 'SponsorAudience' | 'SponsorCard' | 'Sponsor' | 'SponsorInput' | 'SponsorUpdate' | 'SponsorResponse' | 'SponsorSlotResponse';

const ref: RefTo<SponsorSchemaName> = refTo;

const day: Schema = { type: 'string', format: 'date', nullable: true, example: null };
const cardProps = {
  id,
  sponsor: { type: 'string', maxLength: SPONSOR_LIMITS.sponsor, example: 'Casa Agrícola Boa Safra' } satisfies Schema,
  title: { type: 'string', maxLength: SPONSOR_LIMITS.title, example: 'Luvas e botinas com 10% de desconto para quem trabalha pelo Ruraliza' } satisfies Schema,
  text: { type: 'string', maxLength: SPONSOR_LIMITS.text, nullable: true, example: 'Na loja de Três Rios, mostrando o app no caixa.' } satisfies Schema,
  cta_label: { type: 'string', maxLength: SPONSOR_LIMITS.cta_label, example: 'Ver a oferta' } satisfies Schema,
  url: { type: 'string', maxLength: SPONSOR_LIMITS.url, example: 'https://exemplo.com.br/oferta', description: 'Sempre https://.' } satisfies Schema,
  image_url: { type: 'string', nullable: true, example: null, description: 'Logo ou foto (WebP em /api/images).' } satisfies Schema
};
const cardRequired = ['id', 'sponsor', 'title', 'text', 'cta_label', 'url', 'image_url'];
const targeting = {
  audience: ref('SponsorAudience'),
  states: { type: 'array', items: { type: 'string', enum: [...BRAZIL_STATES] }, example: ['RJ', 'MG'], description: 'UFs onde aparece (vazio: todo o Brasil).' } satisfies Schema,
  categories: {
    type: 'array', items: { type: 'string' }, example: ['Colheita'],
    description: 'Para trabalhadores: categorias de interesse que combinam (vazio: qualquer uma).'
  } satisfies Schema,
  starts_on: { ...day, description: 'Primeiro dia (null: já).' },
  ends_on: { ...day, description: 'Último dia (null: sem fim).' },
  active: { type: 'boolean', example: true } satisfies Schema
};

export const sponsorSchemas = {
  SponsorAudience: { type: 'string', enum: [...SPONSOR_AUDIENCES], example: 'all', description: '`farmer` (produtores), `worker` (trabalhadores) ou `all`.' },
  SponsorCard: object(cardProps, cardRequired, 'O cartão "Patrocinado" como o app mostra.'),
  Sponsor: object(
    {
      ...cardProps, ...targeting,
      impressions: { type: 'integer', minimum: 0, example: 120, description: 'Vezes que apareceu.' },
      clicks: { type: 'integer', minimum: 0, example: 9, description: 'Vezes que o link foi aberto.' },
      updated_at: isoDate
    },
    [...cardRequired, 'audience', 'states', 'categories', 'starts_on', 'ends_on', 'active', 'impressions', 'clicks', 'updated_at'],
    'Patrocínio, como a equipe vê.'
  ),
  SponsorInput: input(
    { sponsor: cardProps.sponsor, title: cardProps.title, text: cardProps.text, cta_label: cardProps.cta_label, url: cardProps.url, ...targeting },
    ['sponsor', 'title', 'cta_label', 'url', 'audience'],
    'Patrocínio novo. Os textos passam pelo filtro de palavrões.'
  ),
  SponsorUpdate: input(
    { sponsor: cardProps.sponsor, title: cardProps.title, text: cardProps.text, cta_label: cardProps.cta_label, url: cardProps.url, ...targeting },
    [],
    'Só o que mudou (ao menos um campo).'
  ),
  SponsorResponse: object({ message: { type: 'string', example: 'Sponsor updated.' }, sponsor: ref('Sponsor') }, ['message', 'sponsor']),
  SponsorSlotResponse: object(
    { card: { ...object(cardProps, cardRequired), nullable: true, description: 'O patrocínio da vez (null: nenhum para quem pediu).' } },
    ['card']
  )
} satisfies Record<SponsorSchemaName, Schema>;
