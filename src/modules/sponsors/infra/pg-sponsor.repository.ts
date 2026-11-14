import type { Database } from '#shared/infra/postgres/database';
import { PgRepository } from '#shared/infra/postgres/pg-repository';
import type { SponsorRepository } from '../domain/sponsor';

export function createPgSponsorRepository(db: Database): SponsorRepository {
  return new PgRepository(db, 'sponsors', {
    sponsor: 'value', title: 'value', text: 'value', cta_label: 'value', url: 'value', image_url: 'value', audience: 'value', states: 'value',
    categories: 'value', starts_on: 'value', ends_on: 'value', active: 'value', impressions: 'value', clicks: 'value', updated_at: 'value'
  }, ['active', 'audience']);
}
